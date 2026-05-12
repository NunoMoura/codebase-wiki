import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CodewikiBuildProducesInput, CodewikiBuildRefsInput, CodewikiBuildToolInput, CodewikiClosureBriefInput, CodewikiDiffTableRowInput, CodewikiValidationReportInput, WikiProject, RoadmapTaskRecord } from "../domain/shared/types.ts";
import { nowIso, unique } from "../domain/shared/utils.ts";
import { normalizeWorktreeIsolation } from "./claims.ts";
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

function sha256Text(value: string): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Buffer(value: Buffer): string {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeRepoPath(value: string): string {
	return value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function buildArtifactDigests(project: WikiProject, refs: Array<{ path: string; role: string }>) {
	const files: Array<{ path: string; role: string; sha256: string; bytes: number }> = [];
	const skipped: Array<{ path: string; role: string; reason: string }> = [];
	for (const ref of refs) {
		const path = normalizeRepoPath(ref.path);
		if (!path) continue;
		const absPath = resolve(project.root, path);
		try {
			if (!existsSync(absPath)) {
				skipped.push({ path, role: ref.role, reason: "missing" });
				continue;
			}
			const stats = statSync(absPath);
			if (!stats.isFile()) {
				skipped.push({ path, role: ref.role, reason: "not-file" });
				continue;
			}
			if (stats.size > 1_000_000) {
				skipped.push({ path, role: ref.role, reason: "too-large" });
				continue;
			}
			files.push({ path, role: ref.role, sha256: sha256Buffer(readFileSync(absPath)), bytes: stats.size });
		} catch {
			skipped.push({ path, role: ref.role, reason: "unreadable" });
		}
	}
	return { algorithm: "sha256", files, skipped };
}

function normalizeValidationIsolation(input: CodewikiValidationReportInput["isolation"]) {
	const base = normalizeWorktreeIsolation(input);
	const role = String(input?.role || "").trim();
	const out: Record<string, unknown> = { ...(base ?? {}) };
	if (["builder", "validator", "publisher", "observer"].includes(role)) out.role = role;
	return Object.keys(out).length ? out : undefined;
}

function trimRefGroups(input?: CodewikiBuildRefsInput): CodewikiBuildRefsInput {
	return {
		feedback: trimList(input?.feedback),
		documentation: trimList(input?.documentation),
		implementation: trimList(input?.implementation),
		roadmap: trimList(input?.roadmap),
		validation: trimList(input?.validation),
		source: trimList(input?.source),
	};
}

function trimProduces(input?: CodewikiBuildProducesInput): CodewikiBuildProducesInput {
	return {
		knowledge: trimList(input?.knowledge),
		roadmap: trimList(input?.roadmap),
		code: trimList(input?.code),
		tests: trimList(input?.tests),
		validation: trimList(input?.validation),
		publication: trimList(input?.publication),
		closure: trimList(input?.closure),
	};
}

function mergeProduces(base: CodewikiBuildProducesInput, overrides?: CodewikiBuildProducesInput): CodewikiBuildProducesInput {
	const extra = trimProduces(overrides);
	return {
		knowledge: unique([...(base.knowledge ?? []), ...(extra.knowledge ?? [])]),
		roadmap: unique([...(base.roadmap ?? []), ...(extra.roadmap ?? [])]),
		code: unique([...(base.code ?? []), ...(extra.code ?? [])]),
		tests: unique([...(base.tests ?? []), ...(extra.tests ?? [])]),
		validation: unique([...(base.validation ?? []), ...(extra.validation ?? [])]),
		publication: unique([...(base.publication ?? []), ...(extra.publication ?? [])]),
		closure: unique([...(base.closure ?? []), ...(extra.closure ?? [])]),
	};
}

function normalizeDiffTable(rows?: CodewikiDiffTableRowInput[]) {
	return (rows ?? []).map((row, index) => ({
		id: String(row.id || `DTR-${String(index + 1).padStart(3, "0")}`).trim(),
		current_state: String(row.current_state || "").trim(),
		desired_state: String(row.desired_state || "").trim(),
		rationale: String(row.rationale || "").trim(),
		affected_layers: trimList(row.affected_layers),
		risk: String(row.risk || "medium").trim(),
		user_action: String(row.user_action || "pending").trim(),
		alternatives: trimList(row.alternatives),
	})).filter((row) => row.current_state && row.desired_state && row.rationale);
}

function approvedDiffRows(rows: ReturnType<typeof normalizeDiffTable>, approvedIds?: string[]) {
	const explicitApproved = new Set(trimList(approvedIds));
	return rows.filter((row) => row.user_action === "approved" || explicitApproved.has(row.id));
}

function normalizeClosureBrief(input: CodewikiClosureBriefInput | undefined, task: RoadmapTaskRecord | null, checksRun: string[], acceptanceEvidence: string[], validationRefs: string[], risks: string[]) {
	if (!input) return null;
	return {
		user_intent: String(input.user_intent || task?.goal?.outcome || "").trim(),
		implemented_changes: trimList(input.implemented_changes),
		layers_updated: {
			knowledge: trimList(input.layers_updated?.knowledge),
			roadmap: trimList(input.layers_updated?.roadmap),
			code: trimList(input.layers_updated?.code),
			tests: trimList(input.layers_updated?.tests),
			validation: unique([...trimList(input.layers_updated?.validation), ...validationRefs]),
		},
		acceptance_evidence: trimList(input.acceptance_evidence).length ? trimList(input.acceptance_evidence) : acceptanceEvidence,
		checks: trimList(input.checks).length ? trimList(input.checks) : checksRun,
		non_goals_preserved: trimList(input.non_goals_preserved),
		remaining_risks: trimList(input.remaining_risks).length ? trimList(input.remaining_risks) : risks,
	};
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

function publicationDefaults(
	input: CodewikiBuildToolInput,
	task: RoadmapTaskRecord | null,
	checksRun: string[],
	validationRefs: string[],
	buildPath: string,
	artifactDigests: ReturnType<typeof buildArtifactDigests>,
	payloadDigest: string,
) {
	const taskId = input.task_id?.trim() || task?.id || "implementation-work";
	const taskLabel = task ? `${task.id} ${task.title}` : taskId;
	const archiveRef = input.publication?.archive_ref?.trim() || `refs/codewiki/archive/task/${taskId}`;
	const restoreCommand = input.publication?.restore_command?.trim() || `/wiki-restore ${taskId}`;
	const commitTitle = input.publication?.commit_title?.trim() || `chore(codewiki): record ${taskLabel} implementation evidence`;
	const trailers = [
		`CodeWiki-Task: ${taskId}`,
		`CodeWiki-Build: ${buildPath}`,
		`CodeWiki-Archive-Ref: ${archiveRef}`,
		`CodeWiki-Digest: ${payloadDigest}`,
		`CodeWiki-Restore: ${restoreCommand}`,
	];
	const commitBody = input.publication?.commit_body?.trim() || [
		input.summary.trim(),
		"",
		checksRun.length ? `Checks: ${checksRun.join(", ")}` : "Checks: not recorded in build input.",
		validationRefs.length ? `Validation: ${validationRefs.join(", ")}` : "Validation: no durable validation refs recorded.",
		"Remote publication requires explicit approval; this build is recommendation-only.",
		"",
		...trailers,
	].join("\n");
	const secretScan = input.publication?.secret_scan?.trim() || "required";
	const remoteVisibility = input.publication?.remote_visibility?.trim() || "required";
	const privateEvidence = input.publication?.private_evidence?.trim() || "required";
	const safeToPush = input.publication?.safe_to_push === true && secretScan === "pass" && remoteVisibility === "pass" && privateEvidence === "pass";
	return {
		policy: {
			execution: "recommendation_only",
			approval_required: true,
			remote_updates: "blocked_until_explicit_approval",
			security_review_required: true,
		},
		commit: {
			title: commitTitle,
			body: commitBody,
			trailers,
		},
		pr: {
			title: input.publication?.pr_title?.trim() || commitTitle,
			body: input.publication?.pr_body?.trim() || commitBody,
		},
		issue_update: input.publication?.issue_update?.trim() || "",
		release_notes: input.publication?.release_notes?.trim() || "",
		git: {
			strategy: "implementation_build_publication_payload",
			archive_ref: archiveRef,
			commit_sha: input.publication?.commit_sha?.trim() || "",
			remote: input.publication?.remote?.trim() || "origin",
			branch: input.publication?.branch?.trim() || "",
			atomic_push_refspecs: ["HEAD", archiveRef],
			restore: {
				command: restoreCommand,
				worktree: `git worktree add --detach <tmp> ${archiveRef}`,
				show_build: `git show ${archiveRef}:${buildPath}`,
				sparse_paths: unique([buildPath, ...(task?.spec_paths ?? []), ...(task?.code_paths ?? [])]),
				note: "Restored history is reference material until promoted into active knowledge or roadmap truth.",
			},
		},
		archive_ledger: {
			kind: "task",
			id: taskId,
			build_path: buildPath,
			archive_ref: archiveRef,
			commit_sha: input.publication?.commit_sha?.trim() || "",
			digest: payloadDigest,
			restore_command: restoreCommand,
		},
		artifact_digests: artifactDigests,
		push_readiness: {
			checks_recorded: checksRun,
			validation_refs: validationRefs,
			approval_required: true,
			allowed_by_default: false,
			safe_to_push: safeToPush,
			blocked_reasons: safeToPush ? [] : [
				input.publication?.safe_to_push === true ? "publication safety prerequisites incomplete" : "explicit approval required",
				secretScan === "pass" ? "" : "secret scan required",
				remoteVisibility === "pass" ? "" : "remote visibility review required",
				privateEvidence === "pass" ? "" : "fail/block/private evidence policy required",
			].filter(Boolean),
			security: {
				secret_scan: secretScan,
				remote_visibility: remoteVisibility,
				private_evidence: privateEvidence,
				git_namespaces: "not_access_control",
			},
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
	const diffTable = normalizeDiffTable(input.diff_table);
	const approvedRows = approvedDiffRows(diffTable, input.approved_diff_rows);
	const decisions = trimList(input.decisions).length
		? trimList(input.decisions)
		: approvedRows.map((row) => row.desired_state);
	if (!input.summary?.trim()) throw new Error("Feedback build requires summary.");

	const created = nowIso();
	const slug = buildSlug(input.slug || input.summary, "feedback-build");
	const day = created.slice(0, 10);
	const absPath = buildBuildPath(project, "feedback", slug, day);
	const lifecycle = buildLifecycle(input, created, 30);
	if (lifecycle.state === "accepted" && approvedRows.length === 0) {
		throw new Error("Accepted feedback build requires at least one approved diff_table row.");
	}
	if (!decisions.length) throw new Error("Feedback build requires at least one accepted decision or approved diff_table row.");
	const lowerLayerDelta = {
		knowledge: trimList(input.lower_layer_delta?.knowledge),
		roadmap: trimList(input.lower_layer_delta?.roadmap),
		code: trimList(input.lower_layer_delta?.code),
	};
	const produces = mergeProduces({
		knowledge: lowerLayerDelta.knowledge,
		roadmap: lowerLayerDelta.roadmap,
		code: lowerLayerDelta.code,
	}, input.produces);
	const data = {
		version: 1,
		schema_version: input.schema_version ?? 2,
		kind: "feedback_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		diff_table: diffTable,
		approved_diff_rows: approvedRows.map((row) => row.id),
		accepted_decisions: decisions.map((summary, index) => ({ id: `D${index + 1}`, summary })),
		assumptions: trimList(input.assumptions),
		open_questions: trimList(input.open_questions),
		non_goals: trimList(input.non_goals),
		lower_layer_delta: lowerLayerDelta,
		consumes: trimRefGroups(input.consumes),
		produces,
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
	const knowledgeChanges = trimList(input.knowledge_changes);
	const roadmapChanges = trimList(input.roadmap_changes);
	const consumes = trimRefGroups({
		...input.consumes,
		feedback: unique([input.source_feedback_build.trim(), ...(input.consumes?.feedback ?? [])]),
	});
	const produces = mergeProduces({
		knowledge: knowledgeChanges,
		roadmap: roadmapChanges,
	}, input.produces);
	const data = {
		version: 1,
		schema_version: input.schema_version ?? 2,
		kind: "documentation_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		source_feedback_build: input.source_feedback_build.trim(),
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		knowledge_changes: knowledgeChanges,
		roadmap_changes: roadmapChanges,
		assumptions: trimList(input.assumptions),
		open_questions: trimList(input.open_questions),
		consumes,
		produces,
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
	const relPath = `.codewiki/builds/implementation/${day}-${slug}.json`;
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
	const acceptanceMapping = (input.acceptance_mapping ?? []).filter((m) => m.criterion.trim() && m.evidence.trim());
	const acceptanceEvidence = acceptanceMapping.map((mapping) => `${mapping.criterion}: ${mapping.evidence}`);
	const closureBrief = normalizeClosureBrief(input.closure_brief, task, checksRun, acceptanceEvidence, validationRefs, risks);
	if (lifecycle.state === "accepted" && !closureBrief) {
		throw new Error("Accepted implementation build requires closure_brief.");
	}
	if (closureBrief && (!closureBrief.user_intent || closureBrief.implemented_changes.length === 0 || closureBrief.acceptance_evidence.length === 0 || closureBrief.checks.length === 0)) {
		throw new Error("closure_brief requires user_intent, implemented_changes, acceptance_evidence, and checks.");
	}
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
	const consumes = trimRefGroups({
		...input.consumes,
		documentation: unique([...(sourceDocumentationBuild ? [sourceDocumentationBuild] : []), ...(input.consumes?.documentation ?? [])]),
		roadmap: unique([taskId, ...(input.consumes?.roadmap ?? [])]),
	});
	const produces = mergeProduces({
		code: codeFiles,
		tests: testFiles,
		validation: validationRefs,
		closure: [taskId],
	}, input.produces);
	const artifactDigests = buildArtifactDigests(project, [
		...(sourceDocumentationBuild ? [{ path: sourceDocumentationBuild, role: "source_documentation_build" }] : []),
		...validationRefs.map((path) => ({ path, role: "validation_ref" })),
		...testFiles.map((path) => ({ path, role: "test_file" })),
		...codeFiles.map((path) => ({ path, role: "code_file" })),
	]);
	const payloadDigest = sha256Text(JSON.stringify({
		task_id: taskId,
		summary: input.summary.trim(),
		checks_run: checksRun,
		validation_refs: validationRefs,
		files_changed: unique([...testFiles, ...codeFiles]),
		closure_brief: closureBrief,
		artifact_digests: artifactDigests,
	}));
	const publication = publicationDefaults(input, task, checksRun, validationRefs, relPath, artifactDigests, payloadDigest);
	const data = {
		version: 1,
		schema_version: input.schema_version ?? 2,
		kind: "implementation_build",
		created,
		source: input.source?.trim() || "codewiki_build tool",
		source_documentation_build: sourceDocumentationBuild || undefined,
		task_id: taskId,
		task: taskSnapshot(task),
		status: lifecycle.state,
		lifecycle,
		summary: input.summary.trim(),
		consumes,
		produces,
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
		acceptance_mapping: acceptanceMapping,
		validation_refs: validationRefs,
		closure_brief: closureBrief || undefined,
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
			restore: publication.git.restore,
			fallback: "Use codewiki_state refresh=true and this implementation_build; do not rely on chat transcript memory.",
		},
		publication,
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
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
	const taskPart = input.task_id?.trim() ? `-${input.task_id.trim()}` : "";
	const slug = buildSlug(`${input.profile}-${input.verdict}${taskPart}`, "validation-report");
	const day = created.slice(0, 10);
	const absPath = resolve(project.root, `.codewiki/validation/${day}-${slug}.json`);
	const isolation = normalizeValidationIsolation(input.isolation);
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
		isolation,
	};
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, JSON.stringify(data, null, 2) + "\n", "utf8");
	const relPath = `.codewiki/validation/${day}-${slug}.json`;
	return { path: relPath, data };
}
