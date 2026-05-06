import { GraphEdge, GraphFile, GraphNode, GraphViews, RoadmapTaskRecord, WikiProject } from "../core/types";
import { GitAnchor, GitCache } from "./git-cache";
import { ParsedDoc } from "./parser";

export interface GraphBuildInputs {
	project: WikiProject;
	docs: ParsedDoc[];
	research: any[]; // To be fully typed later
	roadmapEntries: RoadmapTaskRecord[];
	gitCache: GitCache;
}

function nowIso(): string {
	return new Date().toISOString();
}

function isActiveTaskStatus(status: string): boolean {
	return ["in_progress", "blocked"].includes(status);
}

function isOpenTaskStatus(status: string): boolean {
	return ["todo", "in_progress", "blocked", "research"].includes(status);
}

export function buildGraph(inputs: GraphBuildInputs): GraphFile {
	const { project, docs, research, roadmapEntries, gitCache } = inputs;
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
			addNode(`code:${codePath}`, { kind: "code_path", path: codePath });
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
		});

		for (const specPath of task.spec_paths || []) {
			addEdge("task_spec", taskNodeId, `doc:${specPath}`);
		}
		for (const codePath of task.code_paths || []) {
			codePaths.add(codePath);
			addNode(`code:${codePath}`, { kind: "code_path", path: codePath });
			addEdge("task_code_path", taskNodeId, `code:${codePath}`);
		}
		for (const researchId of task.research_ids || []) {
			addEdge("task_research", taskNodeId, `research_entry:${researchId}`);
		}
	}

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
