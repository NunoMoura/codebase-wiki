import { resolve } from "node:path";
import { appendFile, readFile, stat, writeFile } from "node:fs/promises";
import type {
	WikiProject,
	RoadmapFile,
	RoadmapTaskRecord,
	RoadmapTaskUpdateInput,
	RoadmapStatus,
	RoadmapPriority,
	RoadmapStateTaskSummary,
	RoadmapTaskGoal,
	CodewikiTaskPatchInput,
	CodewikiTaskEvidenceInput,
	TaskPhase,
	ToolTaskStatus,
	TaskVerifierResult,
	RoadmapTaskInput,
	TaskLoopUpdateInput,
} from "./types";
import { unique, nowIso, formatError } from "./utils";
import { withLockedPaths } from "../../mutation-queue";
import {
	rebuildTargetPaths,
	runRebuild,
	runRebuildUnlocked,
	roadmapApiTaskState,
	mapToolTaskStatusToRoadmapStatus,
	maybeReadRoadmapState,
	maybeReadTaskContext,
} from "./state";

/**
 * Get the path to the roadmap archive file.
 */
export function roadmapArchivePath(project: WikiProject): string {
	const configured = project.config.roadmap_retention?.archive_path;
	return resolve(project.root, configured || `${project.metaRoot}/roadmap-archive.jsonl`);
}

/**
 * Check if a task patch has any actual changes.
 */
export function hasCodewikiTaskPatchChanges(
	patch: CodewikiTaskPatchInput | undefined,
): patch is CodewikiTaskPatchInput {
	return Boolean(
		patch &&
			(patch.title !== undefined ||
				patch.priority !== undefined ||
				patch.kind !== undefined ||
				patch.summary !== undefined ||
				patch.status !== undefined ||
				patch.phase !== undefined ||
				patch.spec_paths !== undefined ||
				patch.code_paths !== undefined ||
				patch.research_ids !== undefined ||
				patch.labels !== undefined ||
				patch.goal?.outcome !== undefined ||
				patch.goal?.acceptance !== undefined ||
				patch.goal?.non_goals !== undefined ||
				patch.goal?.verification !== undefined ||
				patch.delta?.desired !== undefined ||
				patch.delta?.current !== undefined ||
				patch.delta?.closure !== undefined),
	);
}

/**
 * Build a RoadmapTaskUpdateInput from a CodewikiTaskPatchInput.
 */
export function buildRoadmapTaskUpdateFromCodewikiPatch(
	task: RoadmapTaskRecord,
	runtimeTask: RoadmapStateTaskSummary | null,
	patch: CodewikiTaskPatchInput,
): RoadmapTaskUpdateInput {
	if (
		patch.phase !== undefined &&
		patch.status &&
		patch.status !== "in_progress"
	) {
		throw new Error(
			"Task phase can only be set when status is omitted or 'in_progress'.",
		);
	}
	const currentState = roadmapApiTaskState(task, runtimeTask);
	const requestedStatus =
		patch.status ??
		(patch.phase !== undefined ? "in_progress" : currentState.status);
	const requestedPhase =
		patch.phase === undefined ? currentState.phase : patch.phase;
	return {
		taskId: task.id,
		title: patch.title,
		priority: patch.priority,
		kind: patch.kind,
		summary: patch.summary,
		status: mapToolTaskStatusToRoadmapStatus(requestedStatus, requestedPhase),
		spec_paths: patch.spec_paths,
		code_paths: patch.code_paths,
		research_ids: patch.research_ids,
		labels: patch.labels,
		goal: patch.goal,
		delta: patch.delta,
	};
}

/**
 * Append evidence to a roadmap task.
 */
export async function appendCodewikiTaskEvidence(
	project: WikiProject,
	task: RoadmapTaskRecord,
	evidence: CodewikiTaskEvidenceInput,
	refresh = true,
): Promise<void> {
	await withLockedPaths(
		[
			resolve(project.root, project.eventsPath),
			...(refresh ? rebuildTargetPaths(project) : []),
		],
		async () => {
			await appendTaskEvidenceEvent(project, task, {
				verdict: evidence.result ?? "progress",
				summary: evidence.summary.trim(),
				checks_run: unique(evidence.checks_run ?? []),
				files_touched: unique(evidence.files_touched ?? []),
				issues: unique(evidence.issues ?? []),
			});
			if (refresh) await runRebuildUnlocked(project);
		},
	);
}

/**
 * Check if a RoadmapTaskUpdateInput has any fields to update.
 */
export function hasRoadmapTaskUpdateFields(input: RoadmapTaskUpdateInput): boolean {
	return Boolean(
		input.title !== undefined ||
			input.priority !== undefined ||
			input.kind !== undefined ||
			input.summary !== undefined ||
			input.status !== undefined ||
			input.spec_paths !== undefined ||
			input.code_paths !== undefined ||
			input.research_ids !== undefined ||
			input.labels !== undefined ||
			input.goal !== undefined ||
			input.delta !== undefined,
	);
}

/**
 * Append a general project event to the events file.
 */
export async function appendProjectEvent(project: WikiProject, event: any): Promise<void> {
	const eventPath = resolve(project.root, project.eventsPath);
	await appendFile(eventPath, JSON.stringify(event) + "\n", "utf8");
}

export async function appendRoadmapEvent(project: WikiProject, event: any): Promise<void> {
	const eventPath = resolve(project.root, project.roadmapEventsPath);
	await appendFile(eventPath, JSON.stringify(event) + "\n", "utf8");
}

/**
 * Append a task evidence event to the events file.
 */
export async function appendTaskEvidenceEvent(
	project: WikiProject,
	task: RoadmapTaskRecord,
	evidence: any,
): Promise<void> {
	await appendProjectEvent(project, {
		ts: nowIso(),
		kind: "task_evidence_recorded",
		taskId: task.id,
		title: task.title,
		...evidence,
	});
}

/**
 * Append a task phase transition event to the events file.
 */
export async function appendTaskPhaseEvent(
	project: WikiProject,
	task: RoadmapTaskRecord,
	kind: string,
	phase: string,
	extra: any = {},
): Promise<void> {
	await appendProjectEvent(project, {
		ts: nowIso(),
		kind,
		taskId: task.id,
		title: task.title,
		phase,
		...extra,
	});
}

/**
 * Summarize the result of a codewiki_task tool action.
 */
export function summarizeCodewikiTaskAction(result: {
	action: string;
	changed: boolean;
	canonical_task_ids: string[];
	created?: { id: string; title: string; status: string }[];
	reused?: { id: string; title: string; status: string }[];
	evidence_recorded?: boolean;
}): string {
	const ids = result.canonical_task_ids.join(", ");
	if (result.action === "create") {
		const created = result.created?.length ?? 0;
		const reused = result.reused?.length ?? 0;
		return `codewiki task: created ${created} and reused ${reused} tasks (${ids})`;
	}
	const changed = result.changed ? "updated" : "read";
	const evidence = result.evidence_recorded ? " with evidence" : "";
	return `codewiki task: ${result.action} ${ids} (${changed}${evidence})`;
}

/**
 * Build a prompt for the automatic task verifier.
 */
export type TaskVerifierProfile = "task-close" | "sprint-close" | "roadmap-check" | "drift-check";

export interface TaskVerifierBrief {
	profile: TaskVerifierProfile;
	policy: {
		mode: "read-only";
		parentWritesOnly: true;
		strictJson: true;
	};
	verdict_schema: {
		verdict: ["pass", "fail", "block"];
		taskId: "string";
		checks: "string[]";
		issues: "{severity, summary, evidence?}[]";
		rationale: "string";
	};
	task: Pick<RoadmapTaskRecord, "id" | "title" | "status" | "summary" | "goal" | "spec_paths" | "code_paths">;
	context: any;
	preflight: TaskVerifierResult;
	verifier_rubric?: string;
}

function taskVerifierBlock(taskId: string, rationale: string, checks: string[], issueSummary: string): TaskVerifierResult {
	return {
		verdict: "block",
		taskId,
		checks,
		issues: [{ severity: "medium", summary: issueSummary }],
		rationale,
	};
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

export async function runTaskClosePreflight(project: WikiProject, task: RoadmapTaskRecord): Promise<TaskVerifierResult> {
	const checks = ["task-close deterministic preflight"];
	const issues: TaskVerifierResult["issues"] = [];
	if (!task.goal?.outcome) issues.push({ severity: "high", summary: "Task goal.outcome missing" });
	if (!task.goal?.acceptance?.length) issues.push({ severity: "high", summary: "Task goal.acceptance missing" });
	if (!task.goal?.verification?.length) issues.push({ severity: "medium", summary: "Task goal.verification missing" });
	for (const path of [...(task.spec_paths ?? []), ...(task.code_paths ?? [])]) {
		if (!(await pathExists(resolve(project.root, path)))) {
			issues.push({ severity: "high", summary: `Linked path missing: ${path}` });
		}
	}
	const verifyPackPath = resolve(project.root, project.viewsRoot, "context", "tasks", task.id, "verify.json");
	let verifyPackMtime = 0;
	try {
		verifyPackMtime = (await stat(verifyPackPath)).mtimeMs;
	} catch {
		issues.push({ severity: "medium", summary: `Verifier context pack missing: ${project.viewsRoot}/context/tasks/${task.id}/verify.json` });
	}
	if (verifyPackMtime > 0 && Date.parse(task.updated || task.created || "") > verifyPackMtime) {
		issues.push({ severity: "medium", summary: "Verifier context pack is older than the task record" });
	}
	const eventsText = await readFile(resolve(project.root, project.eventsPath), "utf8").catch(() => "");
	const taskEvents = eventsText.split(/\r?\n/).filter((line) => line.includes(`"taskId":"${task.id}"`));
	const evidenceEvents = taskEvents.filter((line) => line.includes('"kind":"task_evidence_recorded"'));
	if (!evidenceEvents.length) {
		issues.push({ severity: "high", summary: "No task evidence recorded for closure" });
	} else {
		const hasChecks = evidenceEvents.some((line) => {
			try {
				const event = JSON.parse(line);
				return Array.isArray(event.checks_run) && event.checks_run.length > 0;
			} catch {
				return false;
			}
		});
		if (!hasChecks) issues.push({ severity: "high", summary: "No task evidence checks_run recorded for closure" });
	}
	return {
		verdict: issues.some((issue) => issue.severity === "high") ? "fail" : issues.length ? "block" : "pass",
		taskId: task.id,
		checks,
		issues,
		rationale: issues.length ? "Deterministic preflight found closure blockers." : "Deterministic preflight passed.",
	};
}

async function maybeReadVerifierContextPack(project: WikiProject, taskId: string): Promise<any | null> {
	const path = resolve(project.root, project.viewsRoot, "context", "tasks", taskId, "verify.json");
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

function compactText(value: unknown, maxLength = 600): string {
	const text = String(value ?? "");
	return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function compactVerifierContext(context: any): any {
	if (!context || typeof context !== "object") return context;
	return {
		version: context.version,
		role: context.role,
		task: context.task ? {
			id: context.task.id,
			title: context.task.title,
			status: context.task.status,
			priority: context.task.priority,
			kind: context.task.kind,
			summary: context.task.summary,
			goal: context.task.goal,
			delta: context.task.delta,
		} : undefined,
		acceptance_matrix: Array.isArray(context.acceptance_matrix) ? context.acceptance_matrix.map((item: any) => ({
			id: item?.id,
			criterion: item?.criterion,
			status: item?.status,
			checks: Array.isArray(item?.checks) ? item.checks.slice(0, 6) : [],
		})) : [],
		non_goals: Array.isArray(context.non_goals) ? context.non_goals : [],
		required_checks: Array.isArray(context.required_checks) ? context.required_checks : [],
		recent_evidence: Array.isArray(context.recent_evidence) ? context.recent_evidence.slice(-8).map((event: any) => ({
			ts: event?.ts,
			kind: event?.kind,
			verdict: event?.verdict,
			taskId: event?.taskId,
			summary: compactText(event?.summary, 700),
			checks_run: Array.isArray(event?.checks_run) ? event.checks_run.slice(0, 10).map((check: any) => compactText(check, 160)) : [],
			files_touched: Array.isArray(event?.files_touched) ? event.files_touched.slice(0, 12) : [],
			issues: Array.isArray(event?.issues) ? event.issues.slice(0, 5).map((issue: any) => compactText(issue, 240)) : [],
		})) : [],
		context_routes: context.context_routes,
		recommended_next_reads: Array.isArray(context.recommended_next_reads) ? context.recommended_next_reads.slice(0, 16) : [],
		observability: context.observability,
		verdict_policy: context.verdict_policy,
		budget: context.budget,
	};
}

export async function buildTaskVerifierBrief(
	project: WikiProject,
	task: RoadmapTaskRecord,
	context: any,
	profile: TaskVerifierProfile = "task-close",
): Promise<TaskVerifierBrief> {
	const preflight = await runTaskClosePreflight(project, task);
	const verifierRubric = await readFile(resolve(project.root, "skills", "codewiki-verify", "SKILL.md"), "utf8")
		.then((text) => compactText(text, 5000))
		.catch(() => undefined);
	return {
		profile,
		policy: { mode: "read-only", parentWritesOnly: true, strictJson: true },
		verdict_schema: {
			verdict: ["pass", "fail", "block"],
			taskId: "string",
			checks: "string[]",
			issues: "{severity, summary, evidence?}[]",
			rationale: "string",
		},
		task: {
			id: task.id,
			title: task.title,
			status: task.status,
			summary: task.summary,
			goal: task.goal,
			spec_paths: task.spec_paths,
			code_paths: task.code_paths,
		},
		context: compactVerifierContext(context),
		preflight,
		verifier_rubric: verifierRubric,
	};
}

export function buildTaskVerifierPrompt(brief: TaskVerifierBrief): string {
	return [
		"You are the fresh read-only CodeWiki verifier.",
		"Return only strict JSON matching verdict_schema. No markdown, comments, or surrounding diagnostics.",
		"Do not write files or mutate canonical truth; parent process owns evidence and lifecycle writes.",
		"Judge task acceptance against brief, linked context routes, checks, and evidence.",
		brief.verifier_rubric ? `Verifier rubric:\n${brief.verifier_rubric}` : "Verifier rubric: use the CodeWiki verify rubric from the active task brief.",
		`Brief: ${JSON.stringify(brief)}`,
	].join("\n");
}

function isPlainVerifierObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function extractVerifierJson(text: string, taskId = ""): TaskVerifierResult {
	let parsed: any;
	const trimmed = text.trim();
	if (!trimmed || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
		return taskVerifierBlock(taskId, "Failed to parse verifier output", ["strict verifier JSON parse"], "Malformed verifier JSON output");
	}
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return taskVerifierBlock(taskId, "Failed to parse verifier output", ["strict verifier JSON parse"], "Malformed verifier JSON output");
	}
	if (!isPlainVerifierObject(parsed)) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], "Verifier output must be a JSON object");
	}
	const allowedKeys = ["verdict", "taskId", "checks", "issues", "rationale"];
	const extraKeys = Object.keys(parsed).filter((key) => !allowedKeys.includes(key));
	if (extraKeys.length) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], `Verifier output contained extra fields: ${extraKeys.join(", ")}`);
	}
	const verdict = parsed.verdict;
	if (typeof verdict !== "string" || !["pass", "fail", "block"].includes(verdict)) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], "Invalid or missing verifier verdict");
	}
	if (parsed?.taskId !== taskId) {
		return taskVerifierBlock(taskId, "Verifier output task id mismatch", ["strict verifier JSON schema"], "Verifier taskId did not match requested task");
	}
	if (!Array.isArray(parsed.checks) || !parsed.checks.every((check: unknown) => typeof check === "string")) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], "Verifier checks must be a string array");
	}
	const allowedIssueKeys = ["severity", "summary", "evidence"];
	if (!Array.isArray(parsed.issues) || !parsed.issues.every((issue: unknown) => {
		return isPlainVerifierObject(issue)
			&& Object.keys(issue).every((key) => allowedIssueKeys.includes(key))
			&& ["high", "medium", "low"].includes(String(issue.severity))
			&& typeof issue.summary === "string"
			&& (issue.evidence === undefined || typeof issue.evidence === "string");
	})) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], "Verifier issues must contain severity and summary strings");
	}
	if (typeof parsed.rationale !== "string" || !parsed.rationale.trim()) {
		return taskVerifierBlock(taskId, "Verifier output failed schema validation", ["strict verifier JSON schema"], "Verifier rationale must be a non-empty string");
	}
	return {
		verdict: verdict as "pass" | "fail" | "block",
		taskId,
		checks: parsed.checks,
		issues: parsed.issues,
		rationale: parsed.rationale,
	};
}

/**
 * Run the automatic task verifier if enabled.
 */
export type SemanticTaskVerifierRunner = (prompt: string, brief: TaskVerifierBrief) => Promise<string>;

export async function maybeRunAutomaticTaskVerifier(
	project: WikiProject,
	task: RoadmapTaskRecord,
	runSemanticVerifier?: SemanticTaskVerifierRunner,
): Promise<TaskVerifierResult | null> {
	if (process.env.PI_CODEWIKI_SKIP_VERIFIER === "1") return null;
	if (process.env.PI_CODEWIKI_VERIFIER_MODE === "off") return null;
	
	const state = await maybeReadRoadmapState(project.roadmapStatePath);
	const runtimeTask = state?.tasks?.[task.id] ?? null;
	const contextPacket = (await maybeReadVerifierContextPack(project, task.id)) ?? await maybeReadTaskContext(
		project,
		task.id,
		runtimeTask,
	);
	const brief = await buildTaskVerifierBrief(project, task, contextPacket, "task-close");
	if (brief.preflight.verdict !== "pass") return brief.preflight;
	if (!runSemanticVerifier) {
		return {
			verdict: "block",
			taskId: task.id,
			checks: ["semantic verifier adapter"],
			issues: [{ severity: "medium", summary: "Semantic verifier adapter is not configured" }],
			rationale: "No semantic verifier runner was provided by the runtime adapter.",
		};
	}
	const prompt = buildTaskVerifierPrompt(brief);
	try {
		const text = await runSemanticVerifier(prompt, brief);
		return extractVerifierJson(text, task.id);
	} catch (error) {
		return {
			verdict: "block",
			taskId: task.id,
			checks: ["semantic verifier adapter"],
			issues: [
				{
					severity: "medium",
					summary: `Semantic verifier could not complete: ${formatError(error)}`,
				},
			],
			rationale: `Verifier adapter error: ${formatError(error)}`,
		};
	}
}

/**
 * Append tasks to the roadmap.
 */
export async function appendRoadmapTasks(
	_pi: unknown,
	project: WikiProject,
	_ctx: unknown,
	inputs: RoadmapTaskInput[],
	options: { refresh?: boolean } = {},
): Promise<{ created: RoadmapTaskRecord[]; reused: RoadmapTaskRecord[] }> {
	const roadmapPath = resolve(project.root, project.roadmapPath);
	const results: { created: RoadmapTaskRecord[]; reused: RoadmapTaskRecord[] } =
		{ created: [], reused: [] };

	await withLockedPaths(
		roadmapMutationTargetPaths(project, options),
		async () => {
			const roadmap = await readRoadmapFile(roadmapPath);
			const state = await maybeReadRoadmapState(project.roadmapStatePath);

			for (const input of inputs) {
				const existing = resolveRoadmapTask(roadmap, input.id ?? "");
				if (existing) {
					results.reused.push(existing);
					continue;
				}

				const id = input.id ?? formatTaskId(nextTaskIdSequence(roadmap));
				const task: RoadmapTaskRecord = {
					id,
					title: input.title,
					status: input.status ?? "todo",
					priority: input.priority ?? "medium",
					kind: input.kind ?? "task",
					summary: input.summary ?? "",
					spec_paths: unique(input.spec_paths ?? []),
					code_paths: unique(input.code_paths ?? []),
					research_ids: unique(input.research_ids ?? []),
					labels: unique(input.labels ?? []),
					goal: normalizeRoadmapTaskGoal(input.goal, input.summary ?? ""),
					delta: {
						desired: input.delta?.desired ?? "",
						current: input.delta?.current ?? "",
						closure: input.delta?.closure ?? "",
					},
					created: todayIso(),
					updated: todayIso(),
				};

				roadmap.tasks[id] = task;
				roadmap.order.push(id);
				results.created.push(task);

				await appendProjectEvent(project, {
					ts: nowIso(),
					kind: "roadmap_task_created",
					taskId: task.id,
					title: task.title,
				});
				await appendRoadmapEvent(project, {
					ts: nowIso(),
					action: "append",
					taskId: task.id,
					title: task.title,
				});
			}

			roadmap.updated = nowIso();
			await writeRoadmapFile(roadmapPath, roadmap);
			if (options.refresh ?? true) await runRebuildUnlocked(project);
		},
	);

	return results;
}

/**
 * Update a roadmap task.
 */
export async function updateRoadmapTask(
	project: WikiProject,
	update: RoadmapTaskUpdateInput,
	options: { refresh?: boolean } = {},
): Promise<{ task: RoadmapTaskRecord; changed: boolean }> {
	const roadmapPath = resolve(project.root, project.roadmapPath);
	let task: RoadmapTaskRecord | null = null;
	let changed = false;

	await withLockedPaths(
		roadmapMutationTargetPaths(project, options),
		async () => {
			const roadmap = await readRoadmapFile(roadmapPath);
			task = resolveRoadmapTask(roadmap, update.taskId);
			if (!task) throw new Error(`Task not found: ${update.taskId}`);

			if (update.title !== undefined && update.title !== task.title) {
				task.title = update.title;
				changed = true;
			}
			if (update.status !== undefined && update.status !== task.status) {
				task.status = update.status;
				changed = true;
			}
			if (update.priority !== undefined && update.priority !== task.priority) {
				task.priority = update.priority;
				changed = true;
			}
			if (update.kind !== undefined && update.kind !== task.kind) {
				task.kind = update.kind;
				changed = true;
			}
			if (update.summary !== undefined && update.summary !== task.summary) {
				task.summary = update.summary;
				changed = true;
			}
			if (update.spec_paths !== undefined) {
				const next = unique(update.spec_paths);
				if (next.join(",") !== task.spec_paths.join(",")) {
					task.spec_paths = next;
					changed = true;
				}
			}
			if (update.code_paths !== undefined) {
				const next = unique(update.code_paths);
				if (next.join(",") !== task.code_paths.join(",")) {
					task.code_paths = next;
					changed = true;
				}
			}
			if (update.research_ids !== undefined) {
				const next = unique(update.research_ids);
				if (next.join(",") !== task.research_ids.join(",")) {
					task.research_ids = next;
					changed = true;
				}
			}
			if (update.labels !== undefined) {
				const next = unique(update.labels);
				if (next.join(",") !== task.labels.join(",")) {
					task.labels = next;
					changed = true;
				}
			}
			if (update.goal) {
				const next = normalizeRoadmapTaskGoal(
					{
						outcome: task.goal.outcome,
						acceptance: task.goal.acceptance,
						non_goals: task.goal.non_goals,
						verification: task.goal.verification,
						...update.goal,
					},
					task.summary,
				);
				if (JSON.stringify(next) !== JSON.stringify(task.goal)) {
					task.goal = next;
					changed = true;
				}
			}
			if (update.delta) {
				if (update.delta.desired !== undefined)
					task.delta.desired = update.delta.desired;
				if (update.delta.current !== undefined)
					task.delta.current = update.delta.current;
				if (update.delta.closure !== undefined)
					task.delta.closure = update.delta.closure;
				changed = true;
			}

			if (changed) {
				task.updated = nowIso();
				roadmap.updated = nowIso();
				await writeRoadmapFile(roadmapPath, roadmap);

				await appendProjectEvent(project, {
					ts: nowIso(),
					kind: "roadmap_task_updated",
					taskId: task.id,
					title: task.title,
				});
				await appendRoadmapEvent(project, {
					ts: nowIso(),
					action: "update",
					taskId: task.id,
					title: task.title,
				});

				if (options.refresh ?? true) await runRebuildUnlocked(project);
			}
		},
	);

	if (!task) throw new Error("Unexpected state: task is null after update");
	return { task, changed };
}

/**
 * Update the task loop state.
 */
export async function updateTaskLoop(
	project: WikiProject,
	input: TaskLoopUpdateInput & { repoPath?: string },
	options: { refresh?: boolean } = {},
): Promise<{
	taskId: string;
	title: string;
	action: "pass" | "fail" | "block";
	phase: string;
	nextPhase: string;
	roadmapStatus: RoadmapStatus;
}> {
	const task = await readRoadmapTask(project, input.taskId);
	if (!task) throw new Error(`Roadmap task not found: ${input.taskId}`);

	return withLockedPaths(
		roadmapMutationTargetPaths(project, options),
		async () => {
			const roadmapState = await maybeReadRoadmapState(
				project.roadmapStatePath,
			);
			const runtimeTask = roadmapState?.tasks?.[task.id] ?? null;
			const phase = normalizeTaskPhaseValue(
				input.phase ?? taskLoopPhase(runtimeTask),
				"implement",
			);
			const driver = TASK_PHASE_DRIVERS[phase];
			const action = input.action;
			const kind =
				action === "pass"
					? "task_phase_passed"
					: action === "fail"
						? "task_phase_failed"
						: "task_phase_blocked";
			const nextPhase =
				action === "pass"
					? driver.passTo
					: action === "fail"
						? driver.failTo
						: driver.blockTo;

			const roadmapPath = resolve(project.root, project.roadmapPath);
			const roadmap = await readRoadmapFile(roadmapPath);
			const existing = resolveRoadmapTask(roadmap, task.id);
			if (!existing) throw new Error(`Roadmap task not found: ${task.id}`);
			const currentStage = roadmapTaskStage(
				existing.status,
				runtimeTask?.loop?.phase,
			);
			const nextStatus: RoadmapStatus =
				action === "pass"
					? nextPhase === "done"
						? "done"
						: nextPhase === "verify"
							? "verify"
							: "in_progress"
					: action === "fail"
						? "in_progress"
						: "blocked";

			existing.status = nextStatus;
			existing.updated = nowIso();
			roadmap.updated = nowIso();
			await writeRoadmapFile(roadmapPath, roadmap);

			const evidence = {
				taskId: existing.id,
				title: existing.title,
				phase,
				nextPhase,
				summary: input.summary,
				checks_run: unique(input.checks_run ?? []),
				files_touched: unique(input.files_touched ?? []),
				issues: unique(input.issues ?? []),
			};
			await appendProjectEvent(project, {
				ts: nowIso(),
				kind,
				...evidence,
			});
			await appendProjectEvent(project, {
				ts: nowIso(),
				kind: "task_evidence_recorded",
				verdict: action,
				...evidence,
			});

			if (options.refresh ?? true) await runRebuildUnlocked(project);

			return {
				taskId: existing.id,
				title: existing.title,
				action,
				phase,
				nextPhase,
				roadmapStatus: nextStatus,
			};
		},
	);
}

/**
 * Get target paths for roadmap mutations.
 */
export function roadmapMutationTargetPaths(
	project: WikiProject,
	options: { refresh?: boolean },
): string[] {
	return [
		resolve(project.root, project.roadmapPath),
		resolve(project.root, project.eventsPath),
		...((options.refresh ?? true) ? rebuildTargetPaths(project) : []),
	];
}

/**
 * Get the next task ID sequence number.
 */
export function nextTaskIdSequence(roadmap: RoadmapFile): number {
	const sequences = Object.keys(roadmap.tasks)
		.map(parseTaskIdSequence)
		.filter((s): s is number => s !== null);
	return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}

/**
 * Write a roadmap file.
 */
export async function writeRoadmapFile(
	path: string,
	roadmap: RoadmapFile,
): Promise<void> {
	await writeFile(path, JSON.stringify(roadmap, null, 2), "utf8");
}


export const TASK_PHASE_DRIVERS: Record<
	string,
	{
		passTo: TaskPhase | "done";
		failTo: TaskPhase;
		blockTo: TaskPhase;
		guidance: string;
	}
> = {
	implement: {
		passTo: "verify",
		failTo: "implement",
		blockTo: "implement",
		guidance: "change code and wiki artifacts surgically to match specs",
	},
	verify: {
		passTo: "done",
		failTo: "implement",
		blockTo: "verify",
		guidance: "validate fresh-context alignment of intent, knowledge, and code",
	},
};

/**
 * Normalize a task phase value.
 */
export function normalizeTaskPhaseValue(
	value: string | null | undefined,
	fallback: TaskPhase = "implement",
): TaskPhase {
	const phase = value?.trim();
	return phase === "verify"
		? "verify"
		: phase === "implement" || phase === "research"
			? "implement"
			: fallback;
}

/**
 * Get the stage of a task on the roadmap board.
 */
export function roadmapTaskStage(
	status: RoadmapStatus | string | null | undefined,
	loopPhase?: string | null,
): "todo" | TaskPhase | "done" {
	const normalizedStatus = status?.trim();
	if (normalizedStatus === "todo") return "todo";
	if (normalizedStatus === "research") return "implement";
	if (normalizedStatus === "implement" || normalizedStatus === "verify")
		return normalizedStatus as TaskPhase;
	if (normalizedStatus === "done") return "done";
	if (normalizedStatus === "in_progress" || normalizedStatus === "blocked")
		return normalizeTaskPhaseValue(loopPhase, "implement");
	return "implement";
}

/**
 * Get the board column for a task.
 */
export function taskBoardColumn(
	task: RoadmapStateTaskSummary,
): "todo" | TaskPhase | "done" {
	return roadmapTaskStage(task.status, task.loop?.phase);
}

/**
 * Check if a task is blocked.
 */
export function isTaskBlocked(
	task: RoadmapStateTaskSummary | null | undefined,
): boolean {
	return (
		task?.status === "blocked" || task?.loop?.evidence?.verdict === "blocked"
	);
}

/**
 * Get the current phase of a task loop.
 */
export function taskLoopPhase(
	task: RoadmapStateTaskSummary | null | undefined,
): TaskPhase | "done" {
	const stage = roadmapTaskStage(task?.status, task?.loop?.phase);
	if (stage === "todo") return "implement";
	if (stage === "done") return "done";
	return normalizeTaskPhaseValue(task?.loop?.phase, stage as TaskPhase);
}

/**
 * Get a one-line summary of the task loop evidence.
 */
export function taskLoopEvidenceLine(
	task: RoadmapStateTaskSummary | null | undefined,
): string {
	const evidence = task?.loop?.evidence;
	if (!evidence) return "No closure evidence recorded yet.";
	const parts = [evidence.summary || evidence.verdict].filter(Boolean);
	if (evidence.checks_run && evidence.checks_run.length > 0)
		parts.push(`${evidence.checks_run.length} check(s)`);
	if (evidence.issues && evidence.issues.length > 0)
		parts.push(`${evidence.issues.length} issue(s)`);
	return parts.join(" · ") || "Evidence recorded.";
}

/**
 * Check if a roadmap status is closed (done or cancelled).
 */
export function isClosedRoadmapStatus(status: RoadmapStatus): boolean {
	return status === "done" || status === "cancelled";
}

/**
 * Check if a roadmap status is part of the active work loop.
 */
export function isActiveLoopRoadmapStatus(status: RoadmapStatus): boolean {
	return ["research", "implement", "verify", "in_progress", "blocked"].includes(
		status,
	);
}

/**
 * Get a list of potential task ID candidates for a given ID.
 */
export function taskIdCandidates(taskId: string): string[] {
	const trimmed = taskId.trim();
	if (!trimmed) return [];
	const upper = trimmed.toUpperCase();
	const sequence = parseTaskIdSequence(upper);
	if (sequence === null) return unique([trimmed, upper]);
	return unique([
		trimmed,
		upper,
		formatTaskId(sequence),
		formatLegacyTaskId(sequence),
	]);
}

/**
 * Parse the sequence number from a task ID.
 */
export function parseTaskIdSequence(taskId: string): number | null {
	const match = taskId.match(/(?:TASK|ROADMAP)-(\d+)/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Format a task ID from a sequence number.
 */
export function formatTaskId(sequence: number): string {
	return `TASK-${String(sequence).padStart(3, "0")}`;
}

/**
 * Check if a token is a roadmap task ID.
 */
export function isRoadmapTaskToken(value: string): boolean {
	return /^(TASK|ROADMAP)-\d+$/i.test(value);
}

/**
 * Format a legacy task ID from a sequence number.
 */
export function formatLegacyTaskId(sequence: number): string {
	return `ROADMAP-${String(sequence).padStart(3, "0")}`;
}

/**
 * Resolve a roadmap task record from a roadmap file using ID candidates.
 */
export function resolveRoadmapTask(
	roadmap: RoadmapFile,
	requestedId: string,
): RoadmapTaskRecord | null {
	for (const candidate of taskIdCandidates(requestedId)) {
		const task = roadmap.tasks[candidate];
		if (task) return task;
	}
	return null;
}

/**
 * Read a roadmap task from a project.
 */
export async function readRoadmapTask(
	project: WikiProject,
	taskId: string,
): Promise<RoadmapTaskRecord | null> {
	const roadmap = await readRoadmapFile(
		resolve(project.root, project.roadmapPath),
	);
	return resolveRoadmapTask(roadmap, taskId);
}

/**
 * Get the ISO date for today (YYYY-MM-DD).
 */
export function todayIso(): string {
	return nowIso().split("T")[0];
}

/**
 * Normalize a roadmap task goal.
 */
export function normalizeRoadmapTaskGoal(
	goal: any,
	summary: string,
): RoadmapTaskGoal {
	const g = (goal ?? {}) as Partial<RoadmapTaskGoal>;
	const verification = Array.isArray(g.verification) ? g.verification : [];
	return {
		outcome: typeof g.outcome === "string" ? g.outcome : "",
		acceptance: Array.isArray(g.acceptance) ? g.acceptance : [],
		non_goals: Array.isArray(g.non_goals) ? g.non_goals : [],
		verification:
			verification.length > 0
				? verification
				: ["Review task outcome and acceptance criteria."],
	};
}

/**
 * Normalize a roadmap status string.
 */
export function normalizeRoadmapStatus(status: string | undefined): RoadmapStatus {
	const s = String(status || "todo").trim() as RoadmapStatus;
	return s; // Should ideally validate against ROADMAP_STATUS_VALUES
}

/**
 * Normalize a roadmap priority string.
 */
export function normalizeRoadmapPriority(priority: string | undefined): RoadmapPriority {
	const p = String(priority || "medium").trim() as RoadmapPriority;
	return p; // Should ideally validate against ROADMAP_PRIORITY_VALUES
}

/**
 * Read and normalize a roadmap file.
 */
export async function readRoadmapFile(path: string): Promise<RoadmapFile> {
	const { pathExists, readJson } = await import("./utils");
	if (!(await pathExists(path))) {
		return { version: 1, updated: nowIso(), order: [], tasks: {} };
	}
	const data = await readJson<RoadmapFile>(path);
	const rawTasks =
		typeof data.tasks === "object" && data.tasks ? data.tasks : {};
	const tasks = Object.fromEntries(
		Object.entries(rawTasks).map(([taskId, task]) => {
			const record = (task ?? {}) as Partial<RoadmapTaskRecord>;
			return [
				taskId,
				{
					id:
						typeof record.id === "string" && record.id.trim()
							? record.id
							: taskId,
					title: typeof record.title === "string" ? record.title : taskId,
					status: normalizeRoadmapStatus(record.status),
					priority: normalizeRoadmapPriority(record.priority),
					kind: typeof record.kind === "string" ? record.kind : "task",
					summary: typeof record.summary === "string" ? record.summary : "",
					spec_paths: unique(
						Array.isArray(record.spec_paths) ? record.spec_paths : [],
					),
					code_paths: unique(
						Array.isArray(record.code_paths) ? record.code_paths : [],
					),
					research_ids: unique(
						Array.isArray(record.research_ids) ? record.research_ids : [],
					),
					labels: unique(Array.isArray(record.labels) ? record.labels : []),
					goal: normalizeRoadmapTaskGoal(
						record.goal,
						String(record.summary ?? ""),
					),
					delta: {
						desired:
							typeof record.delta?.desired === "string"
								? record.delta.desired
								: "",
						current:
							typeof record.delta?.current === "string"
								? record.delta.current
								: "",
						closure:
							typeof record.delta?.closure === "string"
								? record.delta.closure
								: "",
					},
					created:
						typeof record.created === "string" && record.created.trim()
							? record.created
							: todayIso(),
					updated:
						typeof record.updated === "string" && record.updated.trim()
							? record.updated
							: todayIso(),
				} satisfies RoadmapTaskRecord,
			];
		}),
	);
	return {
		version: data.version ?? 1,
		updated: data.updated ?? nowIso(),
		order: Array.isArray(data.order) ? data.order.filter(Boolean) : [],
		tasks,
	};
}
