import type { GraphEdge, GraphFile, GraphNode, GraphViews, RoadmapTaskRecord, WikiProject } from "../domain/shared/types.ts";
import { GitCache } from "../infrastructure/git-cache.ts";
import type { GitAnchor } from "../infrastructure/git-cache.ts";
import type { ParsedDoc } from "../infrastructure/doc-parser.ts";

export interface GraphBuildInputs {
	project: WikiProject;
	docs: ParsedDoc[];
	research: any[];
	roadmapEntries: RoadmapTaskRecord[];
	gitCache: GitCache;
	builds: { path: string; kind: string; taskId?: string; status?: string; data: any }[];
	validations: { path: string; taskId?: string; verdict?: string; data?: any }[];
	testFiles: string[];
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

type ReconciliationLoop = "feedback" | "documentation" | "implementation" | "observe";

function reconciliationPriority(loop: ReconciliationLoop): number {
	return { feedback: 0, documentation: 1, implementation: 2, observe: 3 }[loop];
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
		observe: "Observe — graph aligned",
	};
	return {
		loop: first.next_loop,
		command: commands[first.next_loop as ReconciliationLoop] || "Observe — graph aligned",
		reason: first.reason,
		item_id: first.id,
	};
}

export function buildGraph(inputs: GraphBuildInputs): GraphFile {
	const { project, docs, research, roadmapEntries, gitCache, builds, validations, testFiles } = inputs;
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
	let dirtyPaths: string[] = [];
	try {
		dirtyPaths = gitCache.getDirtyPaths();
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
			const isDirty = dirtyPaths.some((dirtyPath) => dirtyPath === codePath || dirtyPath.startsWith(`${codePath}/`) || codePath.startsWith(`${dirtyPath}/`));
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
			const isDirty = dirtyPaths.some((dirtyPath) => dirtyPath === codePath || dirtyPath.startsWith(`${codePath}/`) || codePath.startsWith(`${dirtyPath}/`));
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
	const hasPassingValidationForBuild = (build: { path: string; taskId?: string }) => validations.some((validation) => {
		if (String(validation.verdict || "") !== "pass") return false;
		const source = String(validation.data?.source || "").trim();
		if (source && source === build.path) return true;
		return Boolean(build.taskId && validation.taskId === build.taskId);
	});
	for (const build of builds) {
		const lifecycleState = String(build.data?.lifecycle?.state || build.data?.status || build.status || "").trim() || "unknown";
		const buildValidated = hasPassingValidationForBuild(build);
		const buildAlignmentState = ["validated", "archived", "purged"].includes(lifecycleState) || buildValidated ? "aligned" : "drift";
		const buildId = `build:${build.path}`;
		addNode(buildId, {
			kind: build.kind as any,
			path: build.path,
			title: build.data?.source_feedback_build || build.data?.source || build.path,
			status: build.data?.status ?? build.status,
			layer: "build",
			lifecycle_state: lifecycleState,
			alignment_state: buildAlignmentState,
		});
		if (build.kind === "feedback_build" && ["proposed", "accepted"].includes(lifecycleState)) {
			reconciliationItems.push({
				id: `reconcile:${build.path}`,
				source_id: buildId,
				state: "drift",
				direction: "downward",
				from_layer: "intent",
				to_layer: "knowledge",
				next_loop: lifecycleState === "proposed" ? "feedback" : "documentation",
				reason: lifecycleState === "proposed"
					? "Feedback build is proposed; confirm or reject intent before documentation changes."
					: "Accepted feedback build must be applied to canonical knowledge before lower layers are reliable.",
			});
		} else if (build.kind === "documentation_build" && lifecycleState === "accepted") {
			reconciliationItems.push({
				id: `reconcile:${build.path}`,
				source_id: buildId,
				state: "drift",
				direction: "downward",
				from_layer: "knowledge",
				to_layer: "roadmap",
				next_loop: "documentation",
				reason: "Accepted documentation build should produce roadmap task packs before implementation.",
			});
		} else if (build.kind === "implementation_build" && lifecycleState === "accepted" && !buildValidated) {
			reconciliationItems.push({
				id: `reconcile:${build.path}`,
				source_id: buildId,
				state: "drift",
				direction: "gateway",
				from_layer: "build",
				to_layer: "validation",
				next_loop: "implementation",
				task_id: build.taskId,
				reason: "Accepted implementation build still needs passing validation gateway evidence.",
			});
		} else if (["documentation_build", "implementation_build"].includes(build.kind) && lifecycleState === "applied") {
			reconciliationItems.push({
				id: `reconcile:${build.path}`,
				source_id: buildId,
				state: "drift",
				direction: "gateway",
				from_layer: "build",
				to_layer: "validation",
				next_loop: "implementation",
				task_id: build.taskId,
				reason: "Applied compiler build still needs validation gateway evidence.",
			});
		}
		if (build.taskId) {
			addEdge("build_task", buildId, `task:${build.taskId}`);
			if (!buildTaskMap.has(build.taskId)) buildTaskMap.set(build.taskId, []);
			buildTaskMap.get(build.taskId)!.push(build.path);
		}
		for (const [key, value] of Object.entries(build.data || {})) {
			if (key === "source_feedback_build" || key === "source_documentation_build") {
				const srcBuildPath = String(value).replace(/^\\.codewiki\//, "");
				addEdge("build_derives_from", buildId, `build:${srcBuildPath}`);
			}
		}
		for (const v of validations) {
			if (v.path.includes(build.path.replace(/\\.[^.]+$/, "")) || build.path.includes(v.path.replace(/\\.[^.]+$/, ""))) {
				addEdge("build_validated_by", buildId, `validation:${v.path}`);
			}
		}
	}

	// Process Validations
	for (const v of validations) {
		const valNodeId = `validation:${v.path}`;
		addNode(valNodeId, {
			kind: "validation_report",
			path: v.path,
			verdict: v.verdict,
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
		const isDirty = dirtyPaths.some((dirtyPath) => dirtyPath === codePath || dirtyPath.startsWith(`${codePath}/`) || codePath.startsWith(`${dirtyPath}/`));
		if (!isDirty || relatedDocs.length === 0) continue;
		const relatedOpenTaskIds = Array.from(new Set(relatedDocs.flatMap((docPath) => openTasksBySpec.get(docPath) || [])));
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
			status_counts: statusCounts,
		},
		research: {
			collection_paths: research.map(c => c.path),
			entry_ids: Array.from(new Set(researchEntryIds)).sort(),
		},
		code: {
			paths: Array.from(codePaths).sort(),
			dirty_paths: dirtyPaths,
		},
		reconciliation: {
			version: 1,
			controller: "reconciliation_gateway",
			model: "graph-backed-state-machine",
			items: reconciliationItems,
			counts_by_loop: reconciliationCounts,
			next_action: reconciliationAction,
			layer_states: {
				intent: reconciliationItems.some((item) => item.from_layer === "intent" && item.state !== "aligned") ? "drift" : "aligned",
				knowledge: reconciliationItems.some((item) => item.to_layer === "knowledge" && item.state !== "aligned") ? "drift" : "aligned",
				roadmap: reconciliationItems.some((item) => item.from_layer === "roadmap" && item.state !== "aligned") ? "drift" : "aligned",
				code: reconciliationItems.some((item) => item.from_layer === "code" && item.state !== "aligned") ? "drift" : "aligned",
				validation: reconciliationItems.some((item) => item.to_layer === "validation" && item.state !== "aligned") ? "drift" : "aligned",
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
