import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CodewikiBuildToolInput, CodewikiValidationReportInput, WikiProject } from "../domain/shared/types.ts";
import { nowIso } from "../domain/shared/utils.ts";

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

	const created = nowIso();
	const slug = buildSlug(input.slug || input.summary, "implementation-build");
	const day = created.slice(0, 10);
	const absPath = buildBuildPath(project, "implementation", slug, day);
	const lifecycle = buildLifecycle(input, created, 7);
	const data = {
		version: 1,
		kind: "implementation_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		source_documentation_build: (input.source_documentation_build ?? "").trim() || undefined,
		task_id: input.task_id.trim(),
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		test_files: (input.test_files ?? []).map((v) => v.trim()).filter(Boolean),
		code_files: (input.code_files ?? []).map((v) => v.trim()).filter(Boolean),
		checks_run: (input.checks_run ?? []).map((v) => v.trim()).filter(Boolean),
		acceptance_mapping: (input.acceptance_mapping ?? []).filter((m) => m.criterion.trim() && m.evidence.trim()),
		open_questions: (input.open_questions ?? []).map((v) => v.trim()).filter(Boolean),
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
