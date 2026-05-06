import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
	WikiProject,
	CodewikiTaskToolInput,
	CodewikiTaskPatchInput,
	RoadmapTaskRecord,
	RoadmapStateTaskSummary,
	RoadmapTaskUpdateInput,
	ToolTaskStatus,
	TaskPhase,
	RoadmapStatus,
    RoadmapTaskUpdateFields,
    CodewikiTaskEvidenceInput,
} from "../../../core/types";
import { resolve, dirname } from "node:path";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { withLockedPaths } from "../../../../mutation-queue";
import {
	maybeReadRoadmapState,
	maybeReadGraph,
	rebuildTargetPaths,
	runRebuild,
	runRebuildUnlocked,
    roadmapApiTaskState,
    maybeReadTaskContext,
    mapToolTaskStatusToRoadmapStatus,
} from "../../../core/state";
import {
	nowIso,
	unique,
	formatError,
} from "../../../core/utils";
import {
	readRoadmapTask,
	maybeRunAutomaticTaskVerifier,
	appendRoadmapTasks,
	updateRoadmapTask,
	updateTaskLoop,
    roadmapArchivePath,
    appendProjectEvent,
    appendTaskEvidenceEvent,
    hasCodewikiTaskPatchChanges,
    buildRoadmapTaskUpdateFromCodewikiPatch,
    appendCodewikiTaskEvidence,
    summarizeCodewikiTaskAction,
    hasRoadmapTaskUpdateFields,
    readRoadmapFile,
    writeRoadmapFile,
} from "../../../core/roadmap";
import {
	buildCodewikiTaskDetail,
} from "./state";

const execFileAsync = promisify(execFile);

function extractTextContent(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		return value.map((item) => typeof item?.text === "string" ? item.text : "").join("");
	}
	return "";
}

async function runPiTaskCloseVerifier(project: WikiProject, prompt: string): Promise<string> {
	const loader = new DefaultResourceLoader({
		cwd: project.root,
		agentDir: getAgentDir(),
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
	});
	await loader.reload();
	const { session } = await createAgentSession({
		cwd: project.root,
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(project.root),
		tools: ["read", "grep", "find", "ls"],
	});
	let finalText = "";
	const unsubscribe = session.subscribe((event) => {
		const anyEvent = event as any;
		const message = anyEvent?.message;
		if (message?.role === "assistant") {
			const text = extractTextContent(message.content);
			if (text) finalText = text;
		}
		if (anyEvent?.type === "agent_end" && Array.isArray(anyEvent.messages)) {
			const assistantMessage = [...anyEvent.messages].reverse().find((item: any) => item?.role === "assistant");
			const text = extractTextContent(assistantMessage?.content);
			if (text) finalText = text;
		}
	});
	try {
		await session.prompt(prompt);
		if (!finalText.trim()) throw new Error("Verifier session returned no assistant text");
		return finalText;
	} finally {
		unsubscribe();
		await session.dispose();
	}
}

/**
 * Implementation of the codewiki_task tool.
 */
export async function executeCodewikiTask(
	pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiTaskToolInput,
) {
	const refresh = input.refresh ?? true;
	if (input.action === "clear-archive") {
		if (!input.summary?.trim()) {
			throw new Error(
				"codewiki_task clear-archive requires summary confirmation.",
			);
		}
		const archivePath = roadmapArchivePath(project);
		await withLockedPaths([archivePath], async () => {
			await mkdir(dirname(archivePath), { recursive: true });
			const compressed = archivePath.endsWith(".gz");
			await writeFile(archivePath, compressed ? gzipSync("") : "", "utf8");
		});
		await appendProjectEvent(project, {
			ts: nowIso(),
			kind: "roadmap_archive_cleared",
			title: "Cleared roadmap archive",
			summary: input.summary.trim(),
			path: archivePath.replace(`${project.root}/`, ""),
		});
		if (refresh) await runRebuild(project);
		return {
			action: "clear-archive" as const,
			changed: true,
			archive_path: archivePath.replace(`${project.root}/`, ""),
			summary: `codewiki task: cleared roadmap archive ${archivePath.replace(`${project.root}/`, "")}`,
		};
	}
	if (input.action === "checkpoint") {
		if (!input.summary?.trim()) {
			throw new Error("codewiki_task checkpoint requires summary as version or label.");
		}
		let gitSha = "unknown";
		try {
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: project.root });
			gitSha = stdout.trim();
		} catch {}
		let gitDirty = false;
		try {
			const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: project.root });
			gitDirty = stdout.trim().length > 0;
		} catch {}
		const graph = await maybeReadGraph(project.graphPath);
		const state = await maybeReadRoadmapState(project.roadmapStatePath);
		const closedTasks = Object.values(state?.tasks ?? {}).filter(t => ["done", "cancelled"].includes(t.status)).map(t => ({
			id: t.id,
			title: t.title,
			status: t.status,
			closed_at: t.updated,
		}));
		const checkpointPath = resolve(project.root, ".wiki/release-checkpoints.jsonl");
		await withLockedPaths([checkpointPath], async () => {
			const record = {
				ts: nowIso(),
				version_label: input.summary.trim(),
				git_sha: gitSha,
				git_dirty: gitDirty,
				canonical_digest: (graph as any)?.spec_digest ?? "unknown",
				view_schema_version: state?.version ?? 1,
				closed_tasks: closedTasks,
			};
			await appendFile(checkpointPath, JSON.stringify(record) + "\n", "utf8");
		});
		await appendProjectEvent(project, {
			ts: nowIso(),
			kind: "release_checkpoint_created",
			title: "Created release checkpoint",
			summary: input.summary.trim(),
			path: ".wiki/release-checkpoints.jsonl",
		});
		return {
			action: "checkpoint" as const,
			changed: true,
			summary: `codewiki task: created release checkpoint ${input.summary.trim()}`,
		};
	}
	if (input.action === "create") {
		if (!input.tasks?.length)
			throw new Error("codewiki_task create requires tasks.");
		const result = await appendRoadmapTasks(pi, project, ctx, input.tasks, {
			refresh,
		});
		const details = {
			action: "create" as const,
			changed: result.created.length > 0,
			canonical_task_ids: [...result.created, ...result.reused].map(
				(task) => task.id,
			),
			created: result.created.map((task) => ({
				id: task.id,
				title: task.title,
				status: roadmapApiTaskState(task).status,
			})),
			reused: result.reused.map((task) => ({
				id: task.id,
				title: task.title,
				status: roadmapApiTaskState(task).status,
			})),
			evidence_recorded: false,
			summary: "",
		};
		details.summary = summarizeCodewikiTaskAction(details);
		return details;
	}
	if (!input.taskId?.trim()) {
		throw new Error(`codewiki_task ${input.action} requires taskId.`);
	}
	if (input.action === "cancel") {
		if (!input.summary?.trim()) {
			throw new Error("codewiki_task cancel requires summary.");
		}
	}
	if (
		input.action === "update" &&
		!hasCodewikiTaskPatchChanges(input.patch) &&
		!input.evidence
	) {
		throw new Error("codewiki_task update requires patch or evidence.");
	}
	if (
		input.action === "update" &&
		input.evidence?.result &&
		["pass", "fail", "block"].includes(input.evidence.result) &&
		input.patch?.status !== undefined
	) {
		throw new Error(
			"Use evidence.result pass/fail/block without patch.status; lifecycle evidence owns the status transition.",
		);
	}
	const existingTask = await readRoadmapTask(project, input.taskId);
	if (!existingTask) throw new Error(`Roadmap task not found: ${input.taskId}`);
	let runtimeState = await maybeReadRoadmapState(project.roadmapStatePath);
	let runtimeTask = runtimeState?.tasks?.[existingTask.id] ?? null;
	let latestTask = existingTask;
	let changed = false;
	let evidenceRecorded = false;

	if (input.action === "close") {
		if (input.evidence) {
			await appendCodewikiTaskEvidence(
				project,
				latestTask,
				input.evidence,
				false,
			);
			evidenceRecorded = true;
			if (refresh) await runRebuild(project);
		}
		const verifier = await maybeRunAutomaticTaskVerifier(
			project,
			latestTask,
			(prompt) => runPiTaskCloseVerifier(project, prompt),
		);
		if (verifier) {
			await appendCodewikiTaskEvidence(
				project,
				latestTask,
				{
					summary: `Fresh verifier ${verifier.verdict}: ${verifier.rationale}`,
					result:
						verifier.verdict === "pass"
							? "pass"
							: verifier.verdict === "fail"
								? "fail"
								: "block",
					checks_run: verifier.checks,
					files_touched: [],
					issues: verifier.issues.map((issue) => issue.summary),
				},
				false,
			);
			evidenceRecorded = true;
			if (verifier.verdict !== "pass") {
				if (refresh) await runRebuild(project);
				throw new Error(
					`Task ${latestTask.id} cannot close: fresh verifier returned ${verifier.verdict}. ${verifier.rationale}`,
				);
			}
		}
		const closeResult = await updateRoadmapTask(
			project,
			{
				taskId: existingTask.id,
				status: "done",
				summary: input.summary,
			},
			{ refresh: false },
		);
		latestTask = closeResult.task;
		changed = true;
		if (project.config.roadmap_retention?.closed_task_limit === 0) {
			const roadmapPath = resolve(project.root, project.roadmapPath);
			const archivePath = roadmapArchivePath(project);
			await withLockedPaths([roadmapPath, archivePath], async () => {
				const roadmap = await readRoadmapFile(roadmapPath);
				delete roadmap.tasks[latestTask.id];
				roadmap.order = roadmap.order.filter((id) => id !== latestTask.id);
				await writeRoadmapFile(roadmapPath, roadmap);
				await mkdir(dirname(archivePath), { recursive: true });
				await appendFile(archivePath, JSON.stringify(latestTask) + "\n", "utf8");
			});
		}
	} else if (input.action === "cancel") {
		const cancelResult = await updateRoadmapTask(
			project,
			{
				taskId: existingTask.id,
				status: "cancelled",
				summary: input.summary,
			},
			{ refresh: false },
		);
		latestTask = cancelResult.task;
		changed = true;
	} else {
		if (hasCodewikiTaskPatchChanges(input.patch)) {
			const patchUpdate = buildRoadmapTaskUpdateFromCodewikiPatch(
				latestTask,
				runtimeTask,
				input.patch,
			);
			if (hasRoadmapTaskUpdateFields(patchUpdate)) {
				const patchResult = await updateRoadmapTask(project, patchUpdate, {
					refresh: false,
				});
				latestTask = patchResult.task;
				changed = true;
				runtimeState = await maybeReadRoadmapState(project.roadmapStatePath);
				runtimeTask = runtimeState?.tasks?.[latestTask.id] ?? null;
			}
		}
		if (input.evidence) {
			if (
				input.evidence.result === "pass" ||
				input.evidence.result === "fail" ||
				input.evidence.result === "block"
			) {
				await updateTaskLoop(
					project,
					{
						taskId: latestTask.id,
						action: input.evidence.result,
						phase: input.patch?.phase ?? undefined,
						summary: input.evidence.summary,
						checks_run: input.evidence.checks_run,
						files_touched: input.evidence.files_touched,
						issues: input.evidence.issues,
					},
					{ refresh: false },
				);
				evidenceRecorded = true;
				changed = true;
				const reloadedTask = await readRoadmapTask(project, latestTask.id);
				if (reloadedTask) latestTask = reloadedTask;
			} else {
				await appendCodewikiTaskEvidence(
					project,
					latestTask,
					input.evidence,
					false,
				);
				evidenceRecorded = true;
			}
		}
	}
	if (refresh && (changed || evidenceRecorded)) await runRebuild(project);
	const finalRoadmapState = await maybeReadRoadmapState(
		project.roadmapStatePath,
	);
	const finalRuntimeTask =
		finalRoadmapState?.tasks?.[latestTask.id] ?? runtimeTask;
    
	const finalContextPacket = await maybeReadTaskContext(
		project,
		latestTask.id,
		finalRuntimeTask,
	);
	const finalState = buildCodewikiTaskDetail(
		latestTask,
		finalRuntimeTask,
		finalContextPacket,
	);
	const result = {
		action: input.action,
		changed,
		canonical_task_ids: [latestTask.id],
		task: {
			id: finalState.id,
			title: finalState.title,
			status: finalState.status,
			phase: finalState.phase,
			updated: finalState.updated,
		},
		evidence_recorded: evidenceRecorded,
		summary: "",
		created: undefined,
		reused: undefined,
	};
	result.summary = summarizeCodewikiTaskAction(result);
	return result;
}
