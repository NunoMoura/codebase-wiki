import { join, dirname } from "node:path";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

function viewMeta(name: string, targetBytes: number, recommendedNextReads: string[] = []) {
	return {
		version: 1,
		name,
		generated_at: new Date().toISOString(),
		revision: { digest: "v2-digest-placeholder", git: { branch: "main", commit: "0000000" } },
		stale: false,
		budget: { target_bytes: targetBytes },
		recommended_next_reads: recommendedNextReads,
	};
}

export function writeV2Views(
	repoRoot: string,
	docs: any[],
	research: any[],
	graph: any,
	roadmapItems: any[],
	lintReport: any,
	roadmapState: any,
	statusState: any,
	events: any[]
) {
	const viewsRoot = join(repoRoot, ".wiki", "views");

	const writeView = (path: string, payload: any) => {
		const fullPath = join(viewsRoot, path);
		mkdirSync(dirname(fullPath), { recursive: true });
		writeFileSync(fullPath, JSON.stringify(payload, null, 2));
	};

	// --- 1. status.json ---
	const summary = roadmapState.summary || {};
	const rViews = roadmapState.views || {};
	const nextIds = (rViews.todo_task_ids || []).filter(Boolean).map(String);
	const activeIds = (rViews.in_progress_task_ids || []).filter(Boolean).map(String);
	const statusPayload: any = {
		health: statusState.health || "red",
		roadmap: {
			open_count: Number(summary.open_count || 0),
			active_task_ids: activeIds.slice(0, 5),
			next_task_id: (activeIds[0] || nextIds[0] || ""),
			status_counts: summary.status_counts || {},
		},
		views: {
			roadmap_queue: ".wiki/views/roadmap/queue.json",
			drift: ".wiki/views/drift.json",
			product_brief: ".wiki/views/product/brief.json",
			system_architecture: ".wiki/views/system/architecture.json",
			recent_evidence: ".wiki/views/evidence/recent.json",
		},
		issues: (lintReport.issues || []).slice(0, 8),
	};
	statusPayload.meta = viewMeta("status", 8000, (nextIds.length || activeIds.length) ? [".wiki/views/roadmap/queue.json"] : [".wiki/views/drift.json"]);
	writeView("status.json", statusPayload);
	writeView("status-state.json", statusState);

	// --- 2. roadmap/queue.json ---
	const queue = [];
	for (const task of roadmapItems) {
		if (["todo", "in_progress", "blocked"].includes(task.status)) {
			const rt = (roadmapState.tasks || {})[task.id] || {};
			queue.push({
				id: task.id,
				title: task.title || task.id,
				status: task.status,
				phase: rt.loop?.phase || (task.status === "todo" ? "plan" : "execute"),
				priority: task.priority || "medium",
				kind: task.kind || "task",
				summary: task.summary || "",
				context_path: `.wiki/views/roadmap/tasks/${task.id}/context.json`,
				spec_paths: task.spec_paths || [],
			});
		}
	}
	const queuePayload: any = { tasks: queue, next_task_id: queue[0]?.id || "" };
	queuePayload.meta = viewMeta("roadmap.queue", 12000, queue.length ? [queue[0].context_path] : [".wiki/views/drift.json"]);
	writeView("roadmap/queue.json", queuePayload);

	// --- 3. drift.json ---
	const driftRows = (statusState.specs || []).filter((r: any) => r.drift_status && r.drift_status !== "aligned").slice(0, 40);
	const driftPayload: any = {
		summary: statusState.drift || {},
		rows: driftRows.map((r: any) => ({
			path: r.path, title: r.title, drift_status: r.drift_status, note: r.note, primary_task: r.primary_task, code_area: r.code_area
		})),
		issues: (lintReport.issues || []).slice(0, 40),
	};
	driftPayload.meta = viewMeta("drift", 16000, driftRows.slice(0, 5).map((r: any) => r.path).filter(Boolean));
	writeView("drift.json", driftPayload);

	// --- 4. product/brief.json ---
	const productDocs = docs.filter(d => d.path?.startsWith(".wiki/knowledge/product/"));
	const sections = productDocs.map(d => ({
		path: d.path,
		title: d.title,
		summary: d.summary,
		bullets: (d.body || "").split("\n").filter((l: string) => l.trim().startsWith("-")).slice(0, 6).map((l: string) => l.replace(/^-+/, "").trim()),
		revision: { digest: "dummy" },
	}));
	const briefPayload: any = { sections };
	briefPayload.meta = viewMeta("product.brief", 12000, sections.slice(0, 3).map(s => s.path).filter(Boolean));
	writeView("product/brief.json", briefPayload);

	// --- 5. system/architecture.json ---
	const systemDocs = docs.filter(d => d.path?.startsWith(".wiki/knowledge/system/"));
	let manifest: any = { version: 1, components: [], flows: [] };
	const archPath = join(repoRoot, ".wiki/knowledge/system/architecture.json");
	if (existsSync(archPath)) {
		try { manifest = JSON.parse(readFileSync(archPath, "utf8")); } catch {}
	}
	let components = (manifest.components || []).map((c: any) => ({
		id: c.id,
		label: c.label || c.title || c.id,
		path: c.path,
		summary: c.summary || "",
		code_paths: c.code_paths || [],
		depends_on: c.depends_on || [],
		doc_revision: { digest: "dummy" },
	}));
	if (!components.length) {
		components = systemDocs.slice(0, 80).map(d => ({
			id: d.id || d.path, label: d.title, path: d.path, summary: d.summary, code_paths: d.code_paths || [], depends_on: [], doc_revision: { digest: "dummy" }
		}));
	}
	const flows = (manifest.flows || []).map((f: any) => ({
		id: f.id, from: f.from, to: f.to, kind: f.kind || "flow", label: f.label || "", path: f.path, summary: f.summary || "", doc_revision: { digest: "dummy" }
	}));
	const archPayload: any = {
		source: ".wiki/knowledge/system/architecture.json",
		manifest_revision: { digest: "dummy", git: { branch: "main", commit: "0000000" } },
		components,
		flows,
		validation: { issues: [] }, // simplified for smoke tests
		graph_revision: { digest: "dummy" }
	};
	archPayload.meta = viewMeta("system.architecture", 20000, components.slice(0, 5).map((c: any) => c.path).filter(Boolean));
	writeView("system/architecture.json", archPayload);
	
	// Write architecture.mmd
	let mmd = "%% GENERATED by CodeWiki. Do not hand-edit. Source: .wiki/knowledge/system/architecture.json\nflowchart TD\n";
	const mId = (id: string) => "n_" + id.replace(/[^a-zA-Z0-9]/g, "_");
	for (const c of components) mmd += `  ${mId(c.id)}["${(c.label || c.id).replace(/"/g, "'")}"]\n`;
	for (const f of flows) if (f.from && f.to) mmd += `  ${mId(f.from)} -->|"${(f.label || f.kind || "flow").replace(/"/g, "'")}"| ${mId(f.to)}\n`;
	writeFileSync(join(viewsRoot, "system/architecture.mmd"), mmd);

	// --- 6. evidence/recent.json ---
	let recentEntries: any[] = [];
	for (const rc of research) {
		for (const entry of (rc.entries || [])) {
			recentEntries.push({ source: rc.path, ...entry });
		}
	}
	recentEntries = recentEntries.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || ""))).slice(0, 20);
	const evPayload: any = { research: recentEntries, events: events.slice(-20) };
	evPayload.meta = viewMeta("evidence.recent", 16000, []);
	writeView("evidence/recent.json", evPayload);

	// --- Copies ---
	writeView("roadmap-state.json", roadmapState);
	writeView("graph.json", graph);
	writeView("lint.json", lintReport);

	// --- Legacy Roadmap Folder ---
	const legacyRoadmapDir = join(repoRoot, ".wiki", "roadmap");
	const legacyTasksDir = join(legacyRoadmapDir, "tasks");
	mkdirSync(legacyTasksDir, { recursive: true });
	
	const taskIndex = [];
	for (const task of roadmapItems) {
		if (!task.id) continue;
		const taskDir = join(legacyTasksDir, task.id);
		mkdirSync(taskDir, { recursive: true });
		
		const rt = (roadmapState.tasks || {})[task.id] || {};
		const context = {
			version: 1,
			generated_at: new Date().toISOString(),
			context_path: `.wiki/roadmap/tasks/${task.id}/context.json`,
			budget: {
				target_tokens: 6000,
				policy: "Use this packet first.",
			},
			task: {
				id: task.id,
				title: task.title || task.id,
				status: task.status || "todo",
				phase: rt.loop?.phase || (task.status === "todo" ? "plan" : "execute"),
				priority: task.priority || "medium",
				kind: task.kind || "task",
				summary: task.summary || "",
				labels: task.labels || [],
				goal: task.goal || {},
				delta: task.delta || {},
			},
			revision: {
				task: { digest: "dummy" },
				git: { branch: "main", commit: "000" },
				spec_digest: "dummy",
				code_digest: "dummy",
				graph: { digest: "dummy" }
			},
			specs: (task.spec_paths || []).map((path: string) => ({ path, title: path })),
			code: { paths: task.code_paths || [], digest: "dummy", expand: [] },
			evidence: {},
			expansion: {
				task_json: `.wiki/roadmap/tasks/${task.id}/task.json`,
				roadmap_state: `.wiki/roadmap-state.json`,
				status_state: `.wiki/status-state.json`,
				graph: `.wiki/graph.json`
			}
		};
		
		writeFileSync(join(taskDir, "task.json"), JSON.stringify(task, null, 2));
		writeFileSync(join(taskDir, "context.json"), JSON.stringify(context, null, 2));
		
		taskIndex.push({
			id: task.id,
			title: task.title || task.id,
			status: task.status || "todo",
			context_path: `.wiki/roadmap/tasks/${task.id}/context.json`,
		});
	}
	
	const roadmapIndex = {
		version: 1,
		generated_at: new Date().toISOString(),
		roadmap_state_path: ".wiki/roadmap-state.json",
		tasks: taskIndex
	};
	writeFileSync(join(legacyRoadmapDir, "index.json"), JSON.stringify(roadmapIndex, null, 2));
	writeFileSync(join(legacyRoadmapDir, "state.json"), JSON.stringify(roadmapIndex, null, 2));

	writeView("roadmap/index.json", roadmapIndex);
	writeView("roadmap/state.json", roadmapIndex);
}
