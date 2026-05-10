import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CodewikiBuildToolInput, CodewikiValidationReportInput, WikiProject, RoadmapTaskRecord } from "../domain/shared/types.ts";
import { nowIso, unique } from "../domain/shared/utils.ts";
import { readRoadmapTask } from "./roadmap.ts";
import { maybeReadGraph } from "./state-artifacts.ts";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildSlug(value: string, defaultPrefix: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48) || defaultPrefix;
}

function addDaysIso(baseIso: string, days: number): string {
	const date = new Date(baseIso);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString();
}

function buildLifecycle(input: CodewikiBuildToolInput, created: string, defaultTtlDays: number) {
	const ttlDays = input.lifecycle?.ttl_days ?? defaultTtlDays;
	return {
		state: input.lifecycle?.state ?? "accepted",
		ttl_days: ttlDays,
		archive_after: input.lifecycle?.archive_after ?? addDaysIso(created, ttlDays),
		purge_after: input.lifecycle?.purge_after ?? addDaysIso(created, ttlDays * 2),
	};
}

function buildBuildPath(project: WikiProject, kind: string, slug: string, day: string): string {
	const abs = resolve(project.root, `.codewiki/builds/${kind}/${day}-${slug}.json`);
	return abs;
}

function trimList(values?: string[]): string[] {
	return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function taskSnapshot(task: RoadmapTaskRecord | null) {
	if (!task) return undefined;
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		kind: task.kind,
		summary: task.summary,
		spec_paths: task.spec_paths,
		code_paths: task.code_paths,
		goal: task.goal,
	};
}

async function nextFocusTaskId(project: WikiProject, currentTaskId: string): Promise<string> {
	const graph = await maybeReadGraph(project.graphPath) as any;
	const openTaskIds = Array.isArray(graph?.lenses?.roadmap?.views?.open_task_ids)
		? graph.lenses.roadmap.views.open_task_ids.map((id: unknown) => String(id).trim()).filter(Boolean)
		: [];
	return openTaskIds.find((id: string) => id !== currentTaskId) || "";
}

function publicationDefaults(input: CodewikiBuildToolInput, task: RoadmapTaskRecord | null, checksRun: string[], validationRefs: string[]) {
	const taskLabel = task ? `${task.id} ${task.title}` : input.task_id?.trim() || "implementation work";
	const commitTitle = input.publication?.commit_title?.trim() || `chore(codewiki): record ${taskLabel} implementation evidence`;
	const commitBody = input.publication?.commit_body?.trim() || [
		input.summary.trim(),
		"",
		checksRun.length ? `Checks: ${checksRun.join(", ")}` : "Checks: not recorded in build input.",
		validationRefs.length ? `Validation: ${validationRefs.join(", ")}` : "Validation: no durable validation refs recorded.",
		"Remote publication requires explicit approval; this build is recommendation-only.",
	].join("\n");
	return {
		policy: {
			execution: "recommendation_only",
			approval_required: true,
			remote_updates: "blocked_until_explicit_approval",
		},
		commit: {
			title: commitTitle,
			body: commitBody,
		},
		pr: {
			title: input.publication?.pr_title?.trim() || commitTitle,
			body: input.publication?.pr_body?.trim() || commitBody,
		},
		issue_update: input.publication?.issue_update?.trim() || "",
		release_notes: input.publication?.release_notes?.trim() || "",
		push_readiness: {
			checks_recorded: checksRun,
			validation_refs: validationRefs,
			approval_required: true,
			allowed_by_default: false,
		},
	};
}

// ---------------------------------------------------------------------------
// Build writers
// ---------------------------------------------------------------------------

export async function writeFeedbackBuild(
	project: WikiProject,
	input: CodewikiBuildToolInput,
) {
	const decisions = (input.decisions ?? []).map((v) => v.trim()).filter(Boolean);
	if (!input.summary?.trim()) throw new Error("Feedback build requires summary.");
	if (!decisions.length) throw new Error("Feedback build requires at least one accepted decision.");

	const created = nowIso();
	const slug = buildSlug(input.slug || input.summary, "feedback-build");
	const day = created.slice(0, 10);
	const absPath = buildBuildPath(project, "feedback", slug, day);
	const lifecycle = buildLifecycle(input, created, 30);
	const data = {
		version: 1,
		kind: "feedback_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		accepted_decisions: decisions.map((summary, index) => ({ id: `D${index + 1}`, summary })),
		assumptions: (input.assumptions ?? []).map((v) => v.trim()).filter(Boolean),
		open_questions: (input.open_questions ?? []).map((v) => v.trim()).filter(Boolean),
		non_goals: (input.non_goals ?? []).map((v) => v.trim()).filter(Boolean),
		lower_layer_delta: {
			knowledge: input.lower_layer_delta?.knowledge ?? [],
			roadmap: input.lower_layer_delta?.roadmap ?? [],
			code: input.lower_layer_delta?.code ?? [],
		},
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
	const relPath = `.codewiki/builds/feedback/${day}-${slug}.json`;
	return { path: relPath, data };
}

export async function writeDocumentationBuild(
	project: WikiProject,
	input: CodewikiBuildToolInput,
) {
	if (!input.summary?.trim()) throw new Error("Documentation build requires summary.");
	if (!input.source_feedback_build?.trim()) throw new Error("Documentation build requires source_feedback_build.");

	const created = nowIso();
	const slug = buildSlug(input.slug || input.summary, "documentation-build");
	const day = created.slice(0, 10);
	const absPath = buildBuildPath(project, "documentation", slug, day);
	const lifecycle = buildLifecycle(input, created, 14);
	const data = {
		version: 1,
		kind: "documentation_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		source_feedback_build: input.source_feedback_build.trim(),
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		knowledge_changes: (input.knowledge_changes ?? []).map((v) => v.trim()).filter(Boolean),
		roadmap_changes: (input.roadmap_changes ?? []).map((v) => v.trim()).filter(Boolean),
		assumptions: (input.assumptions ?? []).map((v) => v.trim()).filter(Boolean),
		open_questions: (input.open_questions ?? []).map((v) => v.trim()).filter(Boolean),
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
	const relPath = `.codewiki/builds/documentation/${day}-${slug}.json`;
	return { path: relPath, data };
}

export async function writeImplementationBuild(
	project: WikiProject,
	input: CodewikiBuildToolInput,
) {
	if (!input.summary?.trim()) throw new Error("Implementation build requires summary.");
	if (!input.task_id?.trim()) throw new Error("Implementation build requires task_id.");

	const taskId = input.task_id.trim();
	const task = await readRoadmapTask(project, taskId);
	const created = nowIso();
	const slug = buildSlug(input.slug || input.summary, "implementation-build");
	const day = created.slice(0, 10);
	const absPath = buildBuildPath(project, "implementation", slug, day);
	const lifecycle = buildLifecycle(input, created, 7);
	const testFiles = trimList(input.test_files);
	const codeFiles = trimList(input.code_files);
	const checksRun = trimList(input.checks_run);
	const testDesignEvidence = trimList(input.test_design_evidence);
	const codeChangeEvidence = trimList(input.code_change_evidence);
	const testerNotes = trimList(input.tester_notes);
	const builderNotes = trimList(input.builder_notes);
	const validationRefs = trimList(input.validation_refs);
	const risks = trimList(input.risks);
	const openQuestions = trimList(input.open_questions);
	const nextFocus = await nextFocusTaskId(project, taskId);
	const sourceDocumentationBuild = (input.source_documentation_build ?? "").trim();
	const compactContext = {
		source: "implementation_build",
		task_id: taskId,
		title: task?.title ?? taskId,
		summary: input.summary.trim(),
		spec_paths: task?.spec_paths ?? [],
		code_paths: unique([...(task?.code_paths ?? []), ...codeFiles]),
		acceptance: task?.goal?.acceptance ?? [],
		verification: task?.goal?.verification ?? [],
		checks_run: checksRun,
		test_design_evidence: testDesignEvidence,
		code_change_evidence: codeChangeEvidence,
		validation_refs: validationRefs,
	};
	const roleEvidence = {
		tester: {
			role: "tester",
			source_documentation_build: sourceDocumentationBuild || "",
			roadmap_task_id: taskId,
			test_files: testFiles,
			evidence: testDesignEvidence,
			notes: testerNotes,
			boundary: "derive tests or test-design evidence before code changes where practical",
		},
		builder: {
			role: "builder",
			source_documentation_build: sourceDocumentationBuild || "",
			roadmap_task_id: taskId,
			code_files: codeFiles,
			evidence: codeChangeEvidence,
			notes: builderNotes,
			boundary: "change code until tests, roadmap acceptance, and required checks pass",
		},
	};
	const data = {
		version: 1,
		kind: "implementation_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		source_documentation_build: sourceDocumentationBuild || undefined,
		task_id: taskId,
		task: taskSnapshot(task),
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		linked_refs: {
			documentation_build: sourceDocumentationBuild || "",
			spec_paths: task?.spec_paths ?? [],
			code_paths: task?.code_paths ?? [],
		},
		test_files: testFiles,
		code_files: codeFiles,
		files_changed: unique([...testFiles, ...codeFiles]),
		checks_run: checksRun,
		role_evidence: roleEvidence,
		test_design_evidence: testDesignEvidence,
		code_change_evidence: codeChangeEvidence,
		acceptance_mapping: (input.acceptance_mapping ?? []).filter((m) => m.criterion.trim() && m.evidence.trim()),
		validation_refs: validationRefs,
		risks,
		unresolved_issues: openQuestions,
		open_questions: openQuestions,
		handoff: {
			resume: {
				source: "implementation_build",
				command: `/wiki-resume ${taskId}`,
				task_id: taskId,
				next_focus_task_id: nextFocus,
				context: compactContext,
			},
			fallback: "Use codewiki_state refresh=true and this implementation_build; do not rely on chat transcript memory.",
		},
		publication: publicationDefaults(input, task, checksRun, validationRefs),
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
	const relPath = `.codewiki/builds/implementation/${day}-${slug}.json`;
	return { path: relPath, data };
}

export async function writeBuild(
	project: WikiProject,
	input: CodewikiBuildToolInput,
) {
	switch (input.kind) {
		case "feedback":
			return writeFeedbackBuild(project, input);
		case "documentation":
			return writeDocumentationBuild(project, input);
		case "implementation":
			return writeImplementationBuild(project, input);
		default:
			throw new Error(`Unsupported build kind: ${(input as any).kind}`);
	}
}

// ---------------------------------------------------------------------------
// Validation report writer
// ---------------------------------------------------------------------------

export async function writeValidationReport(
	project: WikiProject,
	input: CodewikiValidationReportInput,
) {
	if (!input.profile.trim()) throw new Error("Validation report requires profile.");
	if (!input.verdict) throw new Error("Validation report requires verdict.");
	if (!input.rationale.trim()) throw new Error("Validation report requires rationale.");

	const created = nowIso();
	const slug = buildSlug(`${input.profile}-${input.verdict}`, "validation-report");
	const day = created.slice(0, 10);
	const absPath = resolve(project.root, `.codewiki/validation/${day}-${slug}.json`);
	const data = {
		version: 1,
		kind: "validation_report",
		created,
		profile: input.profile.trim(),
		task_id: (input.task_id ?? "").trim() || undefined,
		verdict: input.verdict,
		rationale: input.rationale.trim(),
		checks: (input.checks ?? []).map((v) => v.trim()).filter(Boolean),
		issues: (input.issues ?? []).map((i) => ({ severity: i.severity.trim(), summary: i.summary.trim() })).filter((i) => i.summary),
		source: (input.source ?? "").trim() || undefined,
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
	const relPath = `.codewiki/validation/${day}-${slug}.json`;
	return { path: relPath, data };
}
