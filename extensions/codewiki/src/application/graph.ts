import type { ChangeClaimsFile, GraphEdge, GraphFile, GraphNode, GraphViews, LintReport, RoadmapTaskRecord, WikiProject } from "../domain/shared/types.ts";
import { GitCache } from "../infrastructure/git-cache.ts";
import type { GitAnchor } from "../infrastructure/git-cache.ts";
import type { ParsedDoc } from "../infrastructure/doc-parser.ts";
import { buildChangeClaimState, claimScopeLabels } from "./claims.ts";

export interface GraphBuildInputs {
	project: WikiProject;
	docs: ParsedDoc[];
	research: any[];
	roadmapEntries: RoadmapTaskRecord[];
	roadmapSprints?: any[];
	gitCache: GitCache;
	builds: { path: string; kind: string; taskId?: string; status?: string; data: any }[];
	validations: { path: string; taskId?: string; verdict?: string; data?: any }[];
	testFiles: string[];
	claims: ChangeClaimsFile;
	lintReport?: LintReport;
}

function nowIso(): string {
	return new Date().toISOString();
}

function isActiveTaskStatus(status: string): boolean {
	return ["in_progress", "blocked"].includes(status);
}

function isOpenTaskStatus(status: string): boolean {
	return ["todo", "in_progress", "blocked", "research", "implement", "verify"].includes(status);
}

type ReconciliationLoop = "feedback" | "documentation" | "implementation" | "validation" | "observe";
type BuildArtifact = GraphBuildInputs["builds"][number];
type ValidationArtifact = GraphBuildInputs["validations"][number];

function reconciliationPriority(loop: ReconciliationLoop): number {
	return { feedback: 0, documentation: 1, implementation: 2, validation: 3, observe: 4 }[loop];
}

function configuredGeneratedPaths(project: WikiProject): string[] {
	return [
		...stringList(project.config?.generated_files),
		...stringList(project.config?.codewiki?.gateway?.generated_readonly_paths),
	];
}

function normalizeScopePath(value: string): string {
	return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\.codewiki\//, "codewiki/");
}

function pathMatchesScope(path: string, scope: string): boolean {
	const normalizedPath = normalizeScopePath(path);
	const normalizedScope = normalizeScopePath(scope);
	if (!normalizedPath || !normalizedScope) return false;
	if (normalizedScope.endsWith("/**")) {
		const prefix = normalizedScope.slice(0, -3);
		return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
	}
	return normalizedPath === normalizedScope;
}

function isGeneratedPath(project: WikiProject, path: string): boolean {
	return configuredGeneratedPaths(project).some((scope) => pathMatchesScope(path, scope));
}

function isCodewikiDataPath(path: string): boolean {
	return normalizeScopePath(path).startsWith("codewiki/");
}

function isPathDirty(dirtyPaths: string[], codePath: string): boolean {
	return dirtyPaths.some((dirtyPath) => dirtyPath === codePath || dirtyPath.startsWith(`${codePath}/`) || codePath.startsWith(`${dirtyPath}/`));
}

function pathsOverlap(left: string, right: string): boolean {
	const a = normalizeScopePath(left);
	const b = normalizeScopePath(right);
	return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`) || pathMatchesScope(a, b) || pathMatchesScope(b, a);
}

function isActionableLintIssue(issue: any): boolean {
	return String(issue?.kind || "") !== "large-doc";
}

function buildReconciliationAction(items: any[]) {
	const active = items
		.filter((item) => String(item.state || "") !== "aligned")
		.sort((a, b) => {
			const p = reconciliationPriority(a.next_loop || "observe") - reconciliationPriority(b.next_loop || "observe");
			if (p !== 0) return p;
			return String(a.id || "").localeCompare(String(b.id || ""));
		});
	const first = active[0];
	if (!first) {
		return {
			loop: "observe" as ReconciliationLoop,
			command: "Observe — graph aligned",
			reason: "No reconciliation item currently requires a compiler loop.",
		};
	}
	const commands: Record<ReconciliationLoop, string> = {
		feedback: "Run feedback compiler",
		documentation: "Run documentation compiler",
		implementation: first.task_id ? `/wiki-resume ${first.task_id}` : "/wiki-resume",
		validation: "Run validation gateway",
		observe: "Observe — graph aligned",
	};
	return {
		loop: first.next_loop,
		command: commands[first.next_loop as ReconciliationLoop] || "Observe — graph aligned",
		reason: first.reason,
		item_id: first.id,
	};
}

function stringList(value: any): string[] {
	if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
	const single = String(value || "").trim();
	return single ? [single] : [];
}

function normalizeCodewikiRef(value: any): string {
	const ref = String(value || "").trim().replace(/\\/g, "/");
	if (!ref) return "";
	if (ref.startsWith(".codewiki/")) return ref;
	if (ref.startsWith("codewiki/")) return `.${ref}`;
	if (ref.startsWith("builds/") || ref.startsWith("validation/")) return `.codewiki/${ref}`;
	return ref;
}

function buildRefs(data: any, key: "feedback" | "documentation" | "implementation"): string[] {
	return [
		...stringList(data?.linked_builds?.[key]),
		...stringList(data?.consumes?.[key]),
	].map(normalizeCodewikiRef).filter(Boolean);
}

function consumedBuildRefs(data: any): string[] {
	return [
		...stringList(data?.source_feedback_build),
		...stringList(data?.source_documentation_build),
		...stringList(data?.consumes?.feedback),
		...stringList(data?.consumes?.documentation),
		...stringList(data?.consumes?.implementation),
	].map(normalizeCodewikiRef).filter(Boolean);
}

function producedRefs(data: any, key: "knowledge" | "roadmap" | "code" | "tests" | "validation" | "publication" | "closure"): string[] {
	return stringList(data?.produces?.[key]).map(normalizeCodewikiRef).filter(Boolean);
}

function buildTaskIds(build: BuildArtifact): string[] {
	const data = build.data || {};
	return Array.from(new Set([
		...stringList(build.taskId),
		...stringList(data.task_id),
		...stringList(data.taskId),
		...stringList(data.task?.id),
		...stringList(data.roadmap_work_items),
		...stringList(data.consumes?.roadmap),
		...stringList(data.produces?.roadmap),
	].map((id) => id.trim()).filter((id) => /^TASK-/.test(id))));
}

function firstTaskId(build: BuildArtifact): string | undefined {
	return buildTaskIds(build)[0];
}

function hasActionableLowerLayerDelta(build: BuildArtifact | undefined): boolean {
	if (!build) return false;
	const delta = build.data?.lower_layer_delta || {};
	return stringList(delta.roadmap).length > 0 || stringList(delta.code).length > 0 || producedRefs(build.data, "roadmap").length > 0 || producedRefs(build.data, "code").length > 0 || producedRefs(build.data, "tests").length > 0;
}

function hasRoadmapChanges(build: BuildArtifact): boolean {
	return stringList(build.data?.roadmap_changes).length > 0 || producedRefs(build.data, "roadmap").length > 0;
}

function isLifecycleComplete(state: string): boolean {
	return ["consumed", "validated", "archived", "purged"].includes(state);
}

function buildArchiveLedger(build: BuildArtifact) {
	const publication = build.data?.publication || {};
	const ledger = publication.archive_ledger || {};
	const git = publication.git || {};
	const taskId = firstTaskId(build) || String(build.data?.task_id || ledger.id || "").trim();
	const archiveRef = String(ledger.archive_ref || git.archive_ref || "").trim();
	if (!taskId || !archiveRef) return null;
	return {
		kind: String(ledger.kind || "task"),
		id: String(ledger.id || taskId),
		build_path: normalizeCodewikiRef(ledger.build_path || build.path),
		archive_ref: archiveRef,
		commit_sha: String(ledger.commit_sha || git.commit_sha || "").trim(),
		digest: String(ledger.digest || "").trim(),
		restore_command: String(ledger.restore_command || git.restore?.command || `/wiki-restore ${taskId}`).trim(),
		safety_status: publication.push_readiness?.safe_to_push === true ? "safe_to_push" : "blocked",
	};
}

function hasArtifactDigestCapture(build: BuildArtifact): boolean {
	return Array.isArray(build.data?.publication?.artifact_digests?.files) && build.data.publication.artifact_digests.files.length > 0;
}

function publicationSafetyPassed(build: BuildArtifact): boolean {
	return build.data?.publication?.push_readiness?.safe_to_push === true;
}

function canCompactColdBuild(build: BuildArtifact, lifecycleState: string, validated: boolean): boolean {
	return build.kind === "implementation_build" && Boolean(buildArchiveLedger(build)) && (validated || isLifecycleComplete(lifecycleState));
}

function isPurgeableByGitArchive(build: BuildArtifact, lifecycleState: string, validated: boolean): boolean {
	return canCompactColdBuild(build, lifecycleState, validated) && hasArtifactDigestCapture(build) && publicationSafetyPassed(build);
}

function validationIsolationSummary(validation: { path: string; taskId?: string; verdict?: string; data?: any }) {
	const isolation = validation.data?.isolation || null;
	const hasSha = Boolean(isolation?.validated_sha || isolation?.published_sha || isolation?.head_sha);
	const isolated = isolation?.fresh_context === true && isolation?.clean === true && hasSha;
	const status = isolation ? (isolated ? "isolated" : "partial") : "legacy";
	return {
		path: validation.path,
		task_id: validation.taskId,
		verdict: validation.verdict,
		status,
		role: isolation?.role,
		worktree_path: isolation?.worktree_path,
		branch: isolation?.branch,
		base_sha: isolation?.base_sha,
		head_sha: isolation?.head_sha,
		validated_sha: isolation?.validated_sha,
		published_sha: isolation?.published_sha,
		clean: isolation?.clean,
		fresh_context: isolation?.fresh_context,
		builder_session_id: isolation?.builder_session_id,
		builder_claim_id: isolation?.builder_claim_id,
		related_claim_ids: isolation?.related_claim_ids || [],
	};
}

function indexPush(map: Map<string, BuildArtifact[]>, key: string, build: BuildArtifact) {
	const normalized = normalizeCodewikiRef(key);
	if (!normalized) return;
	if (!map.has(normalized)) map.set(normalized, []);
	map.get(normalized)!.push(build);
}

export function buildGraph(inputs: GraphBuildInputs): GraphFile {
	const { project, docs, research, roadmapEntries, roadmapSprints = [], gitCache, builds, validations, testFiles, claims, lintReport } = inputs;
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const seenNodes = new Set<string>();
	const seenEdges = new Set<string>();

	const addNode = (nodeId: string, payload: Partial<GraphNode>) => {
		if (!nodeId || seenNodes.has(nodeId)) return;
		seenNodes.add(nodeId);
		nodes.push({ id: nodeId, kind: payload.kind || "unknown", ...payload });
	};

	const addEdge = (kind: string, source: string, target: string) => {
		if (!source || !target) return;
		const key = `${kind}:${source}->${target}`;
		if (seenEdges.has(key)) return;
		seenEdges.add(key);
		edges.push({ kind, from: source, to: target });
	};

	const codePaths = new Set<string>();
	const researchEntryIds: string[] = [];
	const docsByCodePath = new Map<string, string[]>();
	const openTasksBySpec = new Map<string, string[]>();
	const openTaskCodeScopes: { path: string; taskId: string }[] = [];
	const normalizedSprints = roadmapSprints.map((sprint: any) => ({
		id: String(sprint?.id || "").trim(),
		title: String(sprint?.title || sprint?.id || "").trim(),
		status: String(sprint?.status || "planned").trim(),
		outcome: String(sprint?.outcome || sprint?.summary || "").trim(),
		task_ids: stringList(sprint?.task_ids).filter((id) => /^TASK-/.test(id)),
		scope: sprint?.scope || {},
		budget: sprint?.budget || {},
		gates: stringList(sprint?.gates),
	})).filter((sprint) => sprint.id);
	const sprintByTaskId = new Map<string, string[]>();
	for (const sprint of normalizedSprints) {
		for (const taskId of sprint.task_ids) {
			if (!sprintByTaskId.has(taskId)) sprintByTaskId.set(taskId, []);
			sprintByTaskId.get(taskId)!.push(sprint.id);
		}
	}
	let dirtyPaths: string[] = [];
	try {
		dirtyPaths = gitCache.getDirtyPaths().filter((path) => !isGeneratedPath(project, path) && !isCodewikiDataPath(path));
	} catch {
		dirtyPaths = [];
	}

	// Process Docs
	const sortedDocs = [...docs].sort((a, b) => a.path.localeCompare(b.path));
	for (const doc of sortedDocs) {
		const docId = `doc:${doc.path}`;
		
		addNode(docId, {
			kind: "doc",
			path: doc.path,
			title: doc.title,
			doc_type: doc.doc_type,
			group: doc.doc_type === "spec" && doc.path.includes("/") ? doc.path.split("/")[0] : "",
		});

		for (const target of doc.links) {
			addEdge("doc_link", docId, `doc:${target}`);
		}
		for (const codePath of doc.code_paths) {
			codePaths.add(codePath);
			if (!docsByCodePath.has(codePath)) docsByCodePath.set(codePath, []);
			docsByCodePath.get(codePath)!.push(doc.path);
			const isDirty = !isGeneratedPath(project, codePath) && isPathDirty(dirtyPaths, codePath);
			addNode(`code:${codePath}`, { kind: "code_path", path: codePath, layer: "code", alignment_state: isDirty ? "drift" : "aligned" });
			addEdge("doc_code_path", docId, `code:${codePath}`);
		}
	}

	// Process Research Collections
	for (const collection of research) {
		const collectionPath = typeof collection.path === "string" ? collection.path.trim() : "";
		const collectionId = `research_collection:${collectionPath}`;
		addNode(collectionId, { kind: "research_collection", path: collectionPath });

		for (const entry of Array.isArray(collection.entries) ? collection.entries : []) {
			const entryId = typeof entry.id === "string" ? entry.id.trim() : "";
			if (!entryId) continue;
			researchEntryIds.push(entryId);
			
			const entryNodeId = `research_entry:${entryId}`;
			addNode(entryNodeId, {
				kind: "research_entry",
				title: entry.title,
			});
			addEdge("collection_contains_entry", collectionId, entryNodeId);
		}
	}

	// Process Roadmap Sprints
	for (const sprint of normalizedSprints) {
		const sprintNodeId = `sprint:${sprint.id}`;
		addNode(sprintNodeId, {
			kind: "roadmap_sprint",
			title: sprint.title,
			layer: "roadmap",
			status: sprint.status,
			outcome: sprint.outcome,
			budget: sprint.budget,
			gates: sprint.gates,
			alignment_state: ["closed", "cancelled"].includes(sprint.status) ? "aligned" : "drift",
		});
		for (const taskId of sprint.task_ids) addEdge("sprint_task", sprintNodeId, `task:${taskId}`);
		for (const docPath of stringList(sprint.scope?.knowledge)) addEdge("sprint_knowledge_scope", sprintNodeId, `doc:${docPath}`);
		for (const codePath of stringList(sprint.scope?.code)) {
			codePaths.add(codePath);
			addNode(`code:${codePath}`, { kind: "code_path", path: codePath, layer: "code" });
			addEdge("sprint_code_scope", sprintNodeId, `code:${codePath}`);
		}
	}

	// Process Roadmap Tasks
	const statusCounts: Record<string, number> = {};
	for (const task of roadmapEntries) {
		const status = task.status || "todo";
		statusCounts[status] = (statusCounts[status] || 0) + 1;

		const taskId = task.id.trim();
		if (!taskId) continue;

		const taskNodeId = `task:${taskId}`;
		addNode(taskNodeId, {
			kind: "roadmap_task",
			title: task.title,
			layer: "roadmap",
			status,
			alignment_state: isOpenTaskStatus(status) ? "drift" : "aligned",
		});

		for (const specPath of task.spec_paths || []) {
			if (isOpenTaskStatus(status)) {
				if (!openTasksBySpec.has(specPath)) openTasksBySpec.set(specPath, []);
				openTasksBySpec.get(specPath)!.push(taskId);
			}
			addEdge("task_spec", taskNodeId, `doc:${specPath}`);
		}
		for (const codePath of task.code_paths || []) {
			codePaths.add(codePath);
			if (isOpenTaskStatus(status)) openTaskCodeScopes.push({ path: codePath, taskId });
			const isDirty = !isGeneratedPath(project, codePath) && isPathDirty(dirtyPaths, codePath);
			addNode(`code:${codePath}`, { kind: "code_path", path: codePath, layer: "code", alignment_state: isDirty ? "drift" : "aligned" });
			addEdge("task_code_path", taskNodeId, `code:${codePath}`);
		}
		for (const researchId of task.research_ids || []) {
			addEdge("task_research", taskNodeId, `research_entry:${researchId}`);
		}
	}

	// Process Test Files
	for (const testFilePath of testFiles) {
		const testNodeId = `test:${testFilePath}`;
		addNode(testNodeId, { kind: "test_file", path: testFilePath });
		for (const codePath of codePaths) {
			if (testFilePath.includes(codePath.replace(/\\.[^.]+$/, "")) || codePath.includes(testFilePath.replace(/\\.[^.]+$/, ""))) {
				addEdge("test_code", testNodeId, `code:${codePath}`);
			}
		}
	}

	// Process Builds
	const buildTaskMap = new Map<string, string[]>();
	const reconciliationItems: any[] = [];
	const buildsByPath = new Map<string, BuildArtifact>();
	const documentationByFeedback = new Map<string, BuildArtifact[]>();
	const implementationByDocumentation = new Map<string, BuildArtifact[]>();
	const implementationByFeedback = new Map<string, BuildArtifact[]>();

	for (const build of builds) {
		const buildPath = normalizeCodewikiRef(build.path);
		if (buildPath) buildsByPath.set(buildPath, build);
	}
	for (const build of builds) {
		if (build.kind === "documentation_build") {
			indexPush(documentationByFeedback, build.data?.source_feedback_build, build);
			for (const ref of buildRefs(build.data, "feedback")) {
				indexPush(documentationByFeedback, ref, build);
			}
		} else if (build.kind === "implementation_build") {
			for (const ref of [normalizeCodewikiRef(build.data?.source_documentation_build), ...buildRefs(build.data, "documentation")]) {
				indexPush(implementationByDocumentation, ref, build);
			}
			for (const ref of buildRefs(build.data, "feedback")) {
				indexPush(implementationByFeedback, ref, build);
			}
		}
	}

	const hasPassingValidationForBuild = (build: BuildArtifact) => {
		const buildPath = normalizeCodewikiRef(build.path);
		const taskIds = new Set(buildTaskIds(build));
		const validationRefs = new Set([...stringList(build.data?.validation_refs), ...producedRefs(build.data, "validation")].map(normalizeCodewikiRef).filter(Boolean));
		if (String(build.data?.validation_verdict?.verdict || "").trim() === "pass") return true;
		return validations.some((validation: ValidationArtifact) => {
			if (String(validation.verdict || "") !== "pass") return false;
			const sources = [normalizeCodewikiRef(validation.data?.source), ...stringList(validation.data?.sources).map(normalizeCodewikiRef)].filter(Boolean);
			if (sources.includes(buildPath)) return true;
			if (validationRefs.has(normalizeCodewikiRef(validation.path))) return true;
			return Boolean(validation.taskId && taskIds.has(validation.taskId));
		});
	};
	const feedbackConsumed = (build: BuildArtifact) => {
		const buildPath = normalizeCodewikiRef(build.path);
		return Boolean(
			documentationByFeedback.get(buildPath)?.length ||
			implementationByFeedback.get(buildPath)?.length ||
			hasPassingValidationForBuild(build)
		);
	};
	const documentationConsumed = (build: BuildArtifact) => {
		const buildPath = normalizeCodewikiRef(build.path);
		const sourceFeedback = buildsByPath.get(normalizeCodewikiRef(build.data?.source_feedback_build));
		const expectsDownstream = hasActionableLowerLayerDelta(sourceFeedback);
		return Boolean(
			hasRoadmapChanges(build) ||
			implementationByDocumentation.get(buildPath)?.length ||
			hasPassingValidationForBuild(build) ||
			!expectsDownstream
		);
	};
	for (const build of builds) {
		const buildPath = normalizeCodewikiRef(build.path);
		const lifecycleState = String(build.data?.lifecycle?.state || build.data?.status || build.status || "").trim() || "unknown";
		const buildValidated = hasPassingValidationForBuild(build);
		const consumed = build.kind === "feedback_build" ? feedbackConsumed(build) : build.kind === "documentation_build" ? documentationConsumed(build) : false;
		const buildAlignmentState = isLifecycleComplete(lifecycleState) || buildValidated || consumed ? "aligned" : "drift";
		const archiveLedger = buildArchiveLedger(build);
		const compactCold = canCompactColdBuild(build, lifecycleState, buildValidated);
		const buildId = `build:${buildPath}`;
		addNode(buildId, {
			kind: build.kind as any,
			path: buildPath,
			title: build.data?.source_feedback_build || build.data?.source || buildPath,
			status: build.data?.status ?? build.status,
			layer: "build",
			lifecycle_state: lifecycleState,
			alignment_state: buildAlignmentState,
			compacted: compactCold,
			archive_ref: archiveLedger?.archive_ref,
		});
		if (build.kind === "feedback_build" && lifecycleState === "proposed") {
			reconciliationItems.push({
				id: `reconcile:${buildPath}`,
				source_id: buildId,
				state: "drift",
				direction: "downward",
				from_layer: "intent",
				to_layer: "knowledge",
				next_loop: "feedback",
				reason: "Feedback build is proposed; confirm or reject intent before documentation changes.",
			});
		} else if (build.kind === "feedback_build" && lifecycleState === "accepted" && !feedbackConsumed(build)) {
			reconciliationItems.push({
				id: `reconcile:${buildPath}`,
				source_id: buildId,
				state: "drift",
				direction: "downward",
				from_layer: "intent",
				to_layer: "knowledge",
				next_loop: "documentation",
				reason: "Accepted feedback build has no downstream documentation, implementation, or validation evidence yet.",
			});
		} else if (build.kind === "documentation_build" && lifecycleState === "accepted" && !documentationConsumed(build)) {
			reconciliationItems.push({
				id: `reconcile:${buildPath}`,
				source_id: buildId,
				state: "drift",
				direction: "downward",
				from_layer: "knowledge",
				to_layer: "roadmap",
				next_loop: "documentation",
				reason: "Accepted documentation build has actionable downstream delta but no roadmap change, implementation link, or validation evidence yet.",
			});
		} else if (build.kind === "implementation_build" && lifecycleState === "accepted" && !buildValidated) {
			reconciliationItems.push({
				id: `reconcile:${buildPath}`,
				source_id: buildId,
				state: "drift",
				direction: "gateway",
				from_layer: "build",
				to_layer: "validation",
				next_loop: "validation",
				task_id: firstTaskId(build),
				reason: "Accepted implementation build still needs passing validation gateway evidence.",
			});
		} else if (["documentation_build", "implementation_build"].includes(build.kind) && lifecycleState === "applied" && !buildValidated) {
			reconciliationItems.push({
				id: `reconcile:${buildPath}`,
				source_id: buildId,
				state: "drift",
				direction: "gateway",
				from_layer: "build",
				to_layer: "validation",
				next_loop: "validation",
				task_id: firstTaskId(build),
				reason: "Applied compiler build still needs validation gateway evidence.",
			});
		}
		for (const taskId of buildTaskIds(build)) {
			addEdge("build_task", buildId, `task:${taskId}`);
			if (!buildTaskMap.has(taskId)) buildTaskMap.set(taskId, []);
			buildTaskMap.get(taskId)!.push(buildPath);
		}
		if (archiveLedger) {
			const archiveNodeId = `archive_ref:${archiveLedger.archive_ref}`;
			addNode(archiveNodeId, { kind: "git_archive_ref", path: archiveLedger.archive_ref, task_id: archiveLedger.id, digest: archiveLedger.digest, restore_command: archiveLedger.restore_command, safety_status: archiveLedger.safety_status });
			addEdge("build_archive_ref", buildId, archiveNodeId);
		}
		if (compactCold) continue;
		for (const ref of consumedBuildRefs(build.data)) {
			if (ref) addEdge("build_derives_from", buildId, `build:${ref}`);
		}
		for (const ref of stringList(build.data?.consumes?.roadmap)) {
			if (/^TASK-/.test(ref)) addEdge("build_consumes_task", buildId, `task:${ref}`);
		}
		for (const ref of stringList(build.data?.consumes?.validation).map(normalizeCodewikiRef)) {
			if (ref) addEdge("build_consumes_validation", buildId, `validation:${ref}`);
		}
		for (const ref of stringList(build.data?.consumes?.source).map(normalizeCodewikiRef)) {
			if (ref) addEdge("build_consumes_source", buildId, `source:${ref}`);
		}
		for (const ref of producedRefs(build.data, "knowledge")) {
			addEdge("build_produces_knowledge", buildId, `doc:${ref}`);
		}
		for (const ref of producedRefs(build.data, "roadmap")) {
			if (/^TASK-/.test(ref)) addEdge("build_produces_task", buildId, `task:${ref}`);
		}
		for (const ref of producedRefs(build.data, "code")) {
			addNode(`code:${ref}`, { kind: "code_path", path: ref, layer: "code" });
			addEdge("build_produces_code", buildId, `code:${ref}`);
		}
		for (const ref of producedRefs(build.data, "tests")) {
			addNode(`test:${ref}`, { kind: "test_file", path: ref });
			addEdge("build_produces_test", buildId, `test:${ref}`);
		}
		for (const ref of producedRefs(build.data, "validation")) {
			addEdge("build_produces_validation", buildId, `validation:${ref}`);
		}
		for (const ref of producedRefs(build.data, "closure")) {
			addNode(`closure:${ref}`, { kind: "closure_brief", path: ref });
			addEdge("build_produces_closure", buildId, `closure:${ref}`);
		}
		for (const v of validations) {
			if (v.path.includes(build.path.replace(/\\.[^.]+$/, "")) || build.path.includes(v.path.replace(/\\.[^.]+$/, ""))) {
				addEdge("build_validated_by", buildId, `validation:${v.path}`);
			}
		}
	}

	// Process active change claims
	const claimState = buildChangeClaimState(claims);
	for (const claim of claimState.claims) {
		const claimId = `claim:${claim.id}`;
		addNode(claimId, {
			kind: "change_claim",
			claim_id: claim.id,
			session_id: claim.session_id,
			agent_name: claim.agent_name,
			mode: claim.mode,
			role: claim.role,
			status: claim.status,
			summary: claim.summary,
			expires_at: claim.expires_at,
			worktree: claim.worktree,
			scopes: claim.scopes,
		});
		if (claim.task_id) addEdge("claim_task", claimId, `task:${claim.task_id}`);
		if (claim.build_ref) addEdge("claim_build", claimId, `build:${claim.build_ref}`);
		for (const label of claimScopeLabels(claim.scopes)) {
			const scopeId = `claim_scope:${label}`;
			addNode(scopeId, { kind: "change_claim_scope", path: label });
			addEdge("claim_scope", claimId, scopeId);
		}
	}

	// Process Validations
	const validationIsolationRows = validations.map(validationIsolationSummary);
	for (const v of validations) {
		const valNodeId = `validation:${v.path}`;
		const isolation = validationIsolationSummary(v);
		addNode(valNodeId, {
			kind: "validation_report",
			path: v.path,
			verdict: v.verdict,
			isolation_status: isolation.status,
			isolation: v.data?.isolation,
		});
		if (v.taskId) {
			addEdge("validation_task", valNodeId, `task:${v.taskId}`);
		}
		if (v.verdict === "fail" || v.verdict === "block") {
			reconciliationItems.push({
				id: `reconcile:validation:${v.path}`,
				source_id: valNodeId,
				state: v.verdict === "block" ? "blocked" : "drift",
				direction: "gateway",
				from_layer: "validation",
				to_layer: v.verdict === "block" ? "feedback" : "documentation",
				next_loop: v.verdict === "block" ? "feedback" : "documentation",
				task_id: v.taskId,
				reason: v.verdict === "block"
					? "Validation blocked; escalate ambiguous intent to feedback compiler."
					: "Validation failed; return to documentation compiler to fix knowledge/roadmap gaps.",
			});
		}
	}

	for (const issue of lintReport?.issues || []) {
		if (!isActionableLintIssue(issue)) continue;
		const issuePath = String(issue.path || "").trim();
		if (!issuePath) continue;
		const relatedOpenTaskIds = openTasksBySpec.get(issuePath) || [];
		if (relatedOpenTaskIds.length > 0) continue;
		const lintNodeId = `lint:${issue.kind}:${issuePath}`;
		addNode(lintNodeId, {
			kind: "lint_issue",
			path: issuePath,
			layer: "validation",
			severity: issue.severity,
			issue_kind: issue.kind,
			message: issue.message,
		});
		addEdge("lint_issue_path", lintNodeId, `doc:${issuePath}`);
		reconciliationItems.push({
			id: `reconcile:lint:${issue.kind}:${issuePath}`,
			source_id: lintNodeId,
			state: "drift",
			direction: "gateway",
			from_layer: "knowledge",
			to_layer: "roadmap",
			next_loop: "documentation",
			reason: `Lint ${issue.severity} (${issue.kind}) has no open roadmap coverage; reconcile knowledge or create scoped work.`,
			doc_paths: [issuePath],
		});
	}

	// Reconciliation from roadmap and code reality.
	for (const task of roadmapEntries) {
		const status = String(task.status || "todo").trim();
		if (!isOpenTaskStatus(status)) continue;
		const taskId = String(task.id || "").trim();
		reconciliationItems.push({
			id: `reconcile:task:${taskId}`,
			source_id: `task:${taskId}`,
			state: status === "blocked" ? "blocked" : "drift",
			direction: "downward",
			from_layer: "roadmap",
			to_layer: "code",
			next_loop: "implementation",
			task_id: taskId,
			reason: status === "blocked"
				? `${taskId} is blocked; implementation loop needs unblock evidence or rerouting.`
				: `${taskId} is open implementation delta below knowledge.`,
		});
	}
	for (const codePath of codePaths) {
		const relatedDocs = docsByCodePath.get(codePath) || [];
		const isDirty = !isGeneratedPath(project, codePath) && isPathDirty(dirtyPaths, codePath);
		if (!isDirty || relatedDocs.length === 0) continue;
		const relatedOpenTaskIds = Array.from(new Set([
			...relatedDocs.flatMap((docPath) => openTasksBySpec.get(docPath) || []),
			...openTaskCodeScopes.filter((scope) => pathsOverlap(scope.path, codePath)).map((scope) => scope.taskId),
		]));
		if (relatedOpenTaskIds.length > 0) continue;
		reconciliationItems.push({
			id: `reconcile:code:${codePath}`,
			source_id: `code:${codePath}`,
			state: "drift",
			direction: "upward",
			from_layer: "code",
			to_layer: "knowledge",
			next_loop: "documentation",
			reason: `Mapped code changed without open roadmap coverage; reconcile upward into knowledge or feedback if intent is unclear.`,
			doc_paths: relatedDocs,
		});
	}
	const reconciliationAction = buildReconciliationAction(reconciliationItems);
	const reconciliationCounts = reconciliationItems.reduce((acc: Record<string, number>, item: any) => {
		const loop = String(item.next_loop || "observe");
		acc[loop] = (acc[loop] || 0) + 1;
		return acc;
	}, {});
	const layerHasDrift = (layer: string) => reconciliationItems.some(
		(item) => item.state !== "aligned" && (item.from_layer === layer || item.to_layer === layer),
	);
	const openTaskIds = roadmapEntries.filter((task) => isOpenTaskStatus(String(task.status || "todo"))).map((task) => task.id);
	const inProgressTaskIds = roadmapEntries.filter((task) => isActiveTaskStatus(String(task.status || "todo"))).map((task) => task.id);
	const todoTaskIds = roadmapEntries.filter((task) => String(task.status || "todo") === "todo").map((task) => task.id);
	const blockedTaskIds = roadmapEntries.filter((task) => String(task.status || "todo") === "blocked").map((task) => task.id);
	const doneTaskIds = roadmapEntries.filter((task) => String(task.status || "todo") === "done").map((task) => task.id);
	const cancelledTaskIds = roadmapEntries.filter((task) => String(task.status || "todo") === "cancelled").map((task) => task.id);
	const sprintViews = normalizedSprints.map((sprint) => {
		const sprintOpenTaskIds = sprint.task_ids.filter((taskId) => openTaskIds.includes(taskId));
		return {
			id: sprint.id,
			title: sprint.title,
			status: sprint.status,
			outcome: sprint.outcome,
			task_ids: sprint.task_ids,
			open_task_ids: sprintOpenTaskIds,
			budget: sprint.budget,
			gates: sprint.gates,
			scope: sprint.scope,
		};
	});
	const activeSprintIds = sprintViews.filter((sprint) => !["closed", "cancelled"].includes(sprint.status) && (sprint.open_task_ids.length > 0 || sprint.status === "active")).map((sprint) => sprint.id);
	const claimRoleCounts = claimState.claims.reduce((acc: Record<string, number>, claim) => {
		const role = claim.role || "unspecified";
		acc[role] = (acc[role] || 0) + 1;
		return acc;
	}, {});
	const claimIsolationRows = claimState.claims.map((claim) => ({
		id: claim.id,
		role: claim.role || "unspecified",
		mode: claim.mode,
		task_id: claim.task_id,
		worktree_path: claim.worktree?.worktree_path,
		branch: claim.worktree?.branch,
		base_sha: claim.worktree?.base_sha,
		head_sha: claim.worktree?.head_sha,
		validated_sha: claim.worktree?.validated_sha,
		published_sha: claim.worktree?.published_sha,
		clean: claim.worktree?.clean,
		fresh_context: claim.worktree?.fresh_context,
	}));
	const taskScopeViews = Object.fromEntries(roadmapEntries.map((task) => [task.id, {
		kind: "task",
		id: task.id,
		task_ids: [task.id],
		open_task_ids: isOpenTaskStatus(String(task.status || "todo")) ? [task.id] : [],
		sprint_ids: sprintByTaskId.get(task.id) || [],
		spec_paths: task.spec_paths || [],
		code_paths: task.code_paths || [],
	}]));
	const hotBuildPaths = builds.filter((build) => {
		const lifecycleState = String(build.data?.lifecycle?.state || build.data?.status || build.status || "").trim();
		const validated = hasPassingValidationForBuild(build);
		const consumed = build.kind === "feedback_build" ? feedbackConsumed(build) : build.kind === "documentation_build" ? documentationConsumed(build) : false;
		return !isLifecycleComplete(lifecycleState) && !validated && !consumed;
	}).map((build) => normalizeCodewikiRef(build.path)).filter(Boolean);
	const passValidationPaths = validations.filter((v) => String(v.verdict || "") === "pass").map((v) => v.path);
	const failValidationPaths = validations.filter((v) => ["fail", "block"].includes(String(v.verdict || ""))).map((v) => v.path);
	const archiveLedgers = builds.map((build) => buildArchiveLedger(build)).filter(Boolean) as NonNullable<ReturnType<typeof buildArchiveLedger>>[];
	const gitArchivedBuildPaths = builds.filter((build) => Boolean(buildArchiveLedger(build))).map((build) => normalizeCodewikiRef(build.path)).filter(Boolean);
	const purgeableBuilds = builds.filter((build) => {
		const lifecycleState = String(build.data?.lifecycle?.state || build.status || "").trim();
		const validated = hasPassingValidationForBuild(build);
		return lifecycleState === "purged" || isPurgeableByGitArchive(build, lifecycleState, validated);
	});
	const purgeableBuildPaths = purgeableBuilds.map((build) => normalizeCodewikiRef(build.path)).filter(Boolean);
	const purgeableTaskIds = Array.from(new Set(purgeableBuilds.flatMap((build) => buildTaskIds(build))));
	const blockedArchiveBuildPaths = builds.filter((build) => {
		const lifecycleState = String(build.data?.lifecycle?.state || build.status || "").trim();
		const validated = hasPassingValidationForBuild(build);
		return canCompactColdBuild(build, lifecycleState, validated) && !isPurgeableByGitArchive(build, lifecycleState, validated);
	}).map((build) => normalizeCodewikiRef(build.path)).filter(Boolean);
	const gc = {
		policy: {
			hot_days: project.config.codewiki?.gc?.hot_days ?? 7,
			warm_days: project.config.codewiki?.gc?.warm_days ?? 30,
			cold_days: project.config.codewiki?.gc?.cold_days ?? 90,
			purge_days: project.config.codewiki?.gc?.purge_days ?? 180,
			sprint_close_hook: project.config.codewiki?.gc?.sprint_close_hook ?? true,
		},
		classes: {
			hot: {
				task_ids: openTaskIds,
				sprint_ids: activeSprintIds,
				build_paths: hotBuildPaths,
				validation_paths: failValidationPaths,
				claim_ids: claimState.claims.map((claim) => claim.id),
			},
			warm: {
				build_paths: builds.filter((build) => String(build.data?.lifecycle?.state || build.status || "") === "accepted" && !hotBuildPaths.includes(normalizeCodewikiRef(build.path))).map((build) => normalizeCodewikiRef(build.path)).filter(Boolean),
				validation_paths: passValidationPaths.slice(0, 20),
			},
			cold: {
				task_ids: [...doneTaskIds, ...cancelledTaskIds],
				build_paths: builds.filter((build) => isLifecycleComplete(String(build.data?.lifecycle?.state || build.status || "")) || hasPassingValidationForBuild(build)).map((build) => normalizeCodewikiRef(build.path)).filter(Boolean),
				archive_refs: archiveLedgers.map((ledger) => ledger.archive_ref),
			},
			purgeable: {
				task_ids: purgeableTaskIds,
				build_paths: purgeableBuildPaths,
			},
		},
		restore_index: archiveLedgers,
		git_archive: {
			ledger_count: archiveLedgers.length,
			build_paths: gitArchivedBuildPaths,
			blocked_purge_build_paths: blockedArchiveBuildPaths,
			gate: "validated + artifact digests + archive ledger + publication safety pass",
		},
		sprint_close_hooks: [
			"mark consumed builds cold after downstream evidence exists",
			"move pass validation reports to warm/cold evidence",
			"checkpoint closed task shards",
			"purge expired runtime claims and pending diff tables",
		],
	};
	const cursorScope = activeSprintIds[0]
		? { kind: "sprint", id: activeSprintIds[0] }
		: openTaskIds[0]
			? { kind: "task", id: openTaskIds[0] }
			: { kind: "roadmap" };
	const workflowCursor = {
		active_loop: reconciliationAction.loop,
		reason: reconciliationAction.reason,
		expected_output: reconciliationAction.loop === "feedback" ? "feedback_build" : reconciliationAction.loop === "documentation" ? "documentation_build" : reconciliationAction.loop === "implementation" ? "implementation_build" : reconciliationAction.loop === "validation" ? "validation_report" : "observation",
		exit_gate: reconciliationAction.loop === "observe" ? "no drift" : "validation pass or explicit user decision",
		scope: cursorScope,
	};

	// Construct Views
	const docPaths = sortedDocs.map(d => d.path);
	const specPaths = sortedDocs.filter(d => d.doc_type === "spec").map(d => d.path);
	const byGroup: Record<string, string[]> = {};
	for (const path of specPaths) {
		const parts = path.split("/");
		const group = parts.length > 2 ? parts[2] : "unknown";
		if (!byGroup[group]) byGroup[group] = [];
		byGroup[group].push(path);
	}
	
	const views: GraphViews = {
		docs: {
			all_paths: docPaths,
			spec_paths: specPaths,
			by_group: byGroup,
		},
		roadmap: {
			task_ids: roadmapEntries.map(t => t.id),
			open_task_ids: openTaskIds,
			in_progress_task_ids: inProgressTaskIds,
			todo_task_ids: todoTaskIds,
			blocked_task_ids: blockedTaskIds,
			done_task_ids: doneTaskIds,
			cancelled_task_ids: cancelledTaskIds,
			status_counts: statusCounts,
			sprint_ids: sprintViews.map((sprint) => sprint.id),
			active_sprint_ids: activeSprintIds,
			sprints: sprintViews,
		},
		research: {
			collection_paths: research.map(c => c.path),
			entry_ids: Array.from(new Set(researchEntryIds)).sort(),
		},
		code: {
			paths: Array.from(codePaths).sort(),
			dirty_paths: dirtyPaths,
		},
		claims: {
			active_claim_count: claimState.active_claim_count,
			warning_count: claimState.warning_count,
			conflict_count: claimState.conflict_count,
			by_role: claimRoleCounts,
			isolation: claimIsolationRows,
			claims: claimState.claims,
			conflicts: claimState.conflicts,
		},
		validation: {
			isolation: validationIsolationRows,
		},
		scope_views: {
			roadmap: {
				kind: "roadmap",
				task_ids: roadmapEntries.map((task) => task.id),
				open_task_ids: openTaskIds,
				sprint_ids: sprintViews.map((sprint) => sprint.id),
			},
			sprints: Object.fromEntries(sprintViews.map((sprint) => [sprint.id, { kind: "sprint", ...sprint }])),
			tasks: taskScopeViews,
		},
		workflow_cursor: workflowCursor,
		gc,
		reconciliation: {
			version: 1,
			controller: "reconciliation_gateway",
			model: "graph-backed-state-machine",
			items: reconciliationItems,
			counts_by_loop: reconciliationCounts,
			next_action: reconciliationAction,
			layer_states: {
				intent: layerHasDrift("intent") ? "drift" : "aligned",
				knowledge: layerHasDrift("knowledge") ? "drift" : "aligned",
				roadmap: layerHasDrift("roadmap") ? "drift" : "aligned",
				code: layerHasDrift("code") ? "drift" : "aligned",
				validation: layerHasDrift("validation") ? "drift" : "aligned",
			},
		}
	};

	return {
		version: 1,
		generated_at: nowIso(),
		nodes,
		edges,
		views,
	};
}
