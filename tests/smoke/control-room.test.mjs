import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "../../extensions/codewiki/src/application/project.ts";
import {
	buildControlRoomGraphModel,
	buildControlRoomStateModel,
	buildControlRoomSystemModel,
	startControlRoomServer,
} from "../../extensions/codewiki/src/adapters/web/control-room.ts";
import {
	buildBrowserOpenCommand,
	formatControlRoomLaunchMessage,
	parseUiArgs,
} from "../../extensions/codewiki/src/adapters/pi/commands/ui.ts";

const root = await mkdtemp(join(tmpdir(), "codewiki-control-room-"));
let server;
try {
	await mkdir(join(root, ".codewiki/kb/system"), { recursive: true });
	await writeFile(join(root, ".codewiki/config.json"), JSON.stringify({ project_name: "control-room-smoke", schema_version: 4 }, null, 2));
	await writeFile(join(root, ".codewiki/roadmap.json"), JSON.stringify({ version: 2, updated: "2026-05-11", order: [], tasks: {} }, null, 2));
	await writeFile(join(root, ".codewiki/kb/system/architecture.mmd"), `flowchart TD
  User["User / agent intent"]
  API["CodeWiki API\\napi.md"]
  Graph["Graph state machine\\ngraph.md"]
  User --> API
  API --> Graph
  class API,Graph component;
  class User artifact;
`);
	await writeFile(join(root, ".codewiki/kb/system/api.md"), `---
title: CodeWiki API
summary: Stable semantic contract.
state: active
updated: "2026-05-11"
---

# CodeWiki API

## Responsibility

Owns semantic access.
`);
	await writeFile(join(root, ".codewiki/kb/system/graph.md"), `---
title: Graph state machine
summary: Generated state map.
state: active
updated: "2026-05-11"
---

# Graph

## Responsibility

Owns generated graph state.
`);
	await writeFile(join(root, ".codewiki/index_graph.json"), JSON.stringify({
		version: 1,
		generated_at: "2026-05-11T00:00:00Z",
		nodes: [
			{ id: "doc:.codewiki/kb/system/api.md", kind: "doc", path: ".codewiki/kb/system/api.md" },
			{ id: "task:TASK-001", kind: "roadmap_task", path: ".codewiki/roadmap.json" },
		],
		edges: [{ from: "doc:.codewiki/kb/system/api.md", to: "task:TASK-001", kind: "doc_to_task" }],
		lenses: {
			lint: { counts: {}, issues: [], summary: { color: "green", errors: 0, warnings: 0, total_issues: 0 } },
			status: { health: { color: "green", errors: 0, warnings: 0, total: 0 }, roadmap: { open_task_count: 1, next_task_id: "TASK-001" }, next_action: { kind: "resume", summary: "Resume task", command: "/wiki-resume TASK-001" }, claims: { active_claim_count: 0, warning_count: 0, conflict_count: 0 } },
			roadmap: { open_task_count: 1, next_task_id: "TASK-001" },
		},
	}, null, 2));

	const project = await loadProject(root);
	const state = await buildControlRoomStateModel(project);
	assert.equal(state.project.label, "control-room-smoke");
	assert.equal(state.health.color, "green");
	assert.equal(state.roadmap.next, "TASK-001");
	assert.equal(state.graph.nodes, 2);

	const system = await buildControlRoomSystemModel(project);
	assert.equal(system.components.find((component) => component.id === "API")?.doc_path, ".codewiki/kb/system/api.md");
	assert.equal(system.components.find((component) => component.id === "API")?.summary, "Stable semantic contract.");
	assert.equal(system.edges.length, 2);

	const graph = await buildControlRoomGraphModel(project);
	assert.deepEqual(graph.node_kinds, ["doc", "roadmap_task"]);
	assert.equal(graph.stats.shown_edges, 1);

	assert.deepEqual(parseUiArgs("3030 /tmp/repo"), { pathArg: "/tmp/repo", port: 3030 });
	assert.deepEqual(parseUiArgs("/tmp/repo"), { pathArg: "/tmp/repo", port: undefined });
	assert.deepEqual(buildBrowserOpenCommand("http://127.0.0.1:3000/", "darwin"), { command: "open", args: ["http://127.0.0.1:3000/"] });
	assert.deepEqual(buildBrowserOpenCommand("http://127.0.0.1:3000/", "linux"), { command: "xdg-open", args: ["http://127.0.0.1:3000/"] });
	assert.deepEqual(buildBrowserOpenCommand("http://127.0.0.1:3000/", "win32"), { command: "cmd", args: ["/c", "start", "", "http://127.0.0.1:3000/"] });
	assert.equal(buildBrowserOpenCommand("http://127.0.0.1:3000/", "aix"), null);
	assert.equal(
		formatControlRoomLaunchMessage("repo", "http://127.0.0.1:3000/", { opened: true }, false),
		"repo Control Room started; opened browser. URL: http://127.0.0.1:3000/",
	);
	assert.match(
		formatControlRoomLaunchMessage("repo", "http://127.0.0.1:3000/", { opened: false, error: "missing" }, true),
		/Open: http:\/\/127\.0\.0\.1:3000\//,
	);

	server = await startControlRoomServer(project, { port: 0 });
	assert.equal(server.host, "127.0.0.1");
	const html = await fetch(server.url).then((res) => res.text());
	assert.match(html, /CodeWiki Control Room/);
	assert.match(html, /data-view="product"/);
	assert.match(html, /data-view="roadmap"/);
	const css = await fetch(new URL("/assets/control-room.css", server.url)).then((res) => res.text());
	assert.match(css, /--highlight: #f4f1e8/);
	assert.match(css, /--accent: #c7a35a/);
	assert.doesNotMatch(css, /42f5ff|--cyan/i);
	const js = await fetch(new URL("/assets/control-room.js", server.url)).then((res) => res.text());
	assert.match(js, /CodeWiki map/);
	assert.match(js, /data-zoom="graph:in"/);
	assert.match(js, /data-zoom="system:fit"/);
	assert.match(js, /scope <select id="graphScope"/);
	const apiState = await fetch(new URL("/api/state", server.url)).then((res) => res.json());
	assert.equal(apiState.project.label, "control-room-smoke");
} finally {
	if (server) await server.close();
	await rm(root, { recursive: true, force: true });
}
