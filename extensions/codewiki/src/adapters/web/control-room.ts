import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { relative, resolve } from "node:path";
import type { WikiProject } from "../../domain/shared/types.ts";
import { maybeReadGraph, maybeReadRoadmapState, maybeReadStatusState } from "../../application/state-artifacts.ts";
import { maybeReadJson, pathExists, readText } from "../../infrastructure/filesystem.ts";

export interface ControlRoomServerOptions {
	host?: string;
	port?: number;
}

export interface ControlRoomServerHandle {
	host: string;
	port: number;
	url: string;
	close(): Promise<void>;
}

export interface ControlRoomStateModel {
	project: {
		label: string;
		root: string;
	};
	health: {
		color: string;
		errors: number;
		warnings: number;
		total: number;
	};
	roadmap: {
		open: number;
		next: string | null;
		focused: string | null;
	};
	claims: {
		active: number;
		warnings: number;
		conflicts: number;
	};
	graph: {
		generated_at: string | null;
		nodes: number;
		edges: number;
	};
	next_action: {
		kind: string;
		summary: string;
		command: string | null;
	};
}

export interface ControlRoomSystemModel {
	architecture_path: string;
	source: string;
	components: ControlRoomSystemComponent[];
	edges: Array<{ from: string; to: string; kind: string }>;
}

export interface ControlRoomSystemComponent {
	id: string;
	label: string;
	doc_path: string | null;
	kind: "component" | "artifact";
	title: string;
	summary: string;
	state: string | null;
	updated: string | null;
	sections: Array<{ title: string; body: string }>;
}

export interface ControlRoomGraphModel {
	generated_at: string | null;
	stats: {
		total_nodes: number;
		total_edges: number;
		shown_nodes: number;
		shown_edges: number;
		truncated: boolean;
	};
	node_kinds: string[];
	edge_kinds: string[];
	nodes: Array<Record<string, unknown>>;
	edges: Array<Record<string, unknown>>;
}

export async function startControlRoomServer(
	project: WikiProject,
	options: ControlRoomServerOptions = {},
): Promise<ControlRoomServerHandle> {
	const host = options.host ?? "127.0.0.1";
	const requestedPort = options.port ?? 0;
	const server = createServer((req, res) => {
		void handleControlRoomRequest(project, req, res);
	});

	await new Promise<void>((accept, reject) => {
		const onError = (error: Error) => reject(error);
		server.once("error", onError);
		server.listen(requestedPort, host, () => {
			server.off("error", onError);
			accept();
		});
	});

	const address = server.address() as AddressInfo;
	const port = address.port;
	return {
		host,
		port,
		url: `http://${host}:${port}/`,
		close: () =>
			new Promise<void>((accept, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else accept();
				});
			}),
	};
}

export async function buildControlRoomStateModel(project: WikiProject): Promise<ControlRoomStateModel> {
	const graph = await maybeReadGraph(project.graphPath) as any;
	const status = await maybeReadStatusState(project.statusStatePath) as any;
	const roadmap = await maybeReadRoadmapState(project.roadmapStatePath) as any;
	const lint = graph?.lenses?.lint ?? graph?.lint ?? null;
	const health = status?.health ?? lint?.summary ?? graph?.views?.health ?? {};
	const issueCounts = status?.issue_counts ?? health ?? {};
	const roadmapSummary = status?.roadmap ?? roadmap?.summary ?? roadmap ?? {};
	const nextAction = status?.next_action ?? graph?.views?.reconciliation?.next_action ?? {};
	const claims = status?.claims ?? graph?.views?.coordination?.claims ?? graph?.views?.coordination ?? {};

	return {
		project: {
			label: project.label,
			root: project.root,
		},
		health: {
			color: String(health.color ?? (issueCounts.errors ? "red" : issueCounts.warnings ? "yellow" : "green")),
			errors: numberFrom(issueCounts.errors ?? health.errors),
			warnings: numberFrom(issueCounts.warnings ?? health.warnings),
			total: numberFrom(issueCounts.total ?? health.total_issues ?? health.total),
		},
		roadmap: {
			open: numberFrom(roadmapSummary.open_task_count ?? roadmapSummary.open ?? roadmap?.open_task_count),
			next: stringOrNull(roadmapSummary.next_task_id ?? roadmapSummary.next ?? roadmap?.next_task_id),
			focused: stringOrNull(roadmapSummary.focused_task_id ?? status?.resume?.task_id),
		},
		claims: {
			active: numberFrom(claims.active_claim_count ?? claims.active ?? status?.active_claim_count),
			warnings: numberFrom(claims.warning_count ?? claims.warnings ?? status?.claim_warning_count),
			conflicts: numberFrom(claims.conflict_count ?? claims.conflicts ?? status?.claim_conflict_count),
		},
		graph: {
			generated_at: stringOrNull(graph?.generated_at),
			nodes: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
			edges: Array.isArray(graph?.edges) ? graph.edges.length : 0,
		},
		next_action: {
			kind: String(nextAction.kind ?? nextAction.type ?? "observe"),
			summary: String(nextAction.summary ?? nextAction.reason ?? nextAction.label ?? "Inspect CodeWiki state."),
			command: stringOrNull(nextAction.command),
		},
	};
}

export async function buildControlRoomSystemModel(project: WikiProject): Promise<ControlRoomSystemModel> {
	const architecturePath = resolve(project.root, ".codewiki/kb/system/architecture.mmd");
	const source = await readTextIfExists(architecturePath);
	const parsed = parseArchitectureMermaid(source);
	const componentClasses = parseClassMembership(source, "component");
	const artifactClasses = parseClassMembership(source, "artifact");
	const components: ControlRoomSystemComponent[] = [];
	for (const node of parsed.nodes) {
		const docPath = node.doc ? `.codewiki/kb/system/${node.doc}` : null;
		const absoluteDocPath = docPath ? resolve(project.root, docPath) : null;
		const doc = absoluteDocPath ? await readMarkdownDoc(absoluteDocPath) : null;
		const kind: "component" | "artifact" = componentClasses.has(node.id)
			? "component"
			: artifactClasses.has(node.id)
				? "artifact"
				: node.doc
					? "component"
					: "artifact";
		components.push({
			id: node.id,
			label: node.label,
			doc_path: docPath,
			kind,
			title: doc?.frontmatter.title ?? node.label,
			summary: doc?.frontmatter.summary ?? "No component summary found.",
			state: doc?.frontmatter.state ?? null,
			updated: doc?.frontmatter.updated ?? null,
			sections: doc?.sections ?? [],
		});
	}
	return {
		architecture_path: relative(project.root, architecturePath),
		source,
		components,
		edges: parsed.edges.map((edge) => ({ ...edge, kind: "architecture" })),
	};
}

export async function buildControlRoomGraphModel(
	project: WikiProject,
	options: { maxNodes?: number; maxEdges?: number } = {},
): Promise<ControlRoomGraphModel> {
	const maxNodes = options.maxNodes ?? 180;
	const maxEdges = options.maxEdges ?? 360;
	const graph = await maybeReadJson<any>(project.graphPath);
	const allNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
	const allEdges = Array.isArray(graph?.edges) ? graph.edges : [];
	const nodes = allNodes.slice(0, maxNodes).map(normalizeGraphNode);
	const visibleIds = new Set(nodes.map((node) => String(node.id)));
	const edges = allEdges
		.filter((edge: any) => visibleIds.has(String(edge.from)) && visibleIds.has(String(edge.to)))
		.slice(0, maxEdges)
		.map(normalizeGraphEdge);
	return {
		generated_at: stringOrNull(graph?.generated_at),
		stats: {
			total_nodes: allNodes.length,
			total_edges: allEdges.length,
			shown_nodes: nodes.length,
			shown_edges: edges.length,
			truncated: allNodes.length > nodes.length || allEdges.length > edges.length,
		},
		node_kinds: uniqueSorted(allNodes.map((node: any) => String(node.kind ?? "unknown"))),
		edge_kinds: uniqueSorted(allEdges.map((edge: any) => String(edge.kind ?? "edge"))),
		nodes,
		edges,
	};
}

async function handleControlRoomRequest(
	project: WikiProject,
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
	try {
		if (req.method !== "GET") {
			writeTextResponse(res, 405, "Method not allowed", "text/plain; charset=utf-8");
			return;
		}
		switch (requestUrl.pathname) {
			case "/":
			case "/index.html":
				writeTextResponse(res, 200, CONTROL_ROOM_HTML, "text/html; charset=utf-8");
				return;
			case "/assets/control-room.css":
				writeTextResponse(res, 200, CONTROL_ROOM_CSS, "text/css; charset=utf-8");
				return;
			case "/assets/control-room.js":
				writeTextResponse(res, 200, CONTROL_ROOM_JS, "text/javascript; charset=utf-8");
				return;
			case "/api/state":
				writeJsonResponse(res, 200, await buildControlRoomStateModel(project));
				return;
			case "/api/system":
				writeJsonResponse(res, 200, await buildControlRoomSystemModel(project));
				return;
			case "/api/graph":
				writeJsonResponse(res, 200, await buildControlRoomGraphModel(project));
				return;
			case "/api/health":
				writeJsonResponse(res, 200, { ok: true, project: project.label });
				return;
			default:
				writeJsonResponse(res, 404, { error: "Not found" });
		}
	} catch (error) {
		writeJsonResponse(res, 500, { error: String(error instanceof Error ? error.message : error) });
	}
}

function writeTextResponse(res: ServerResponse, status: number, body: string, contentType: string): void {
	res.writeHead(status, {
		"content-type": contentType,
		"cache-control": "no-store",
	});
	res.end(body);
}

function writeJsonResponse(res: ServerResponse, status: number, body: unknown): void {
	writeTextResponse(res, status, `${JSON.stringify(body, null, 2)}\n`, "application/json; charset=utf-8");
}

function parseArchitectureMermaid(source: string): {
	nodes: Array<{ id: string; label: string; doc: string | null }>;
	edges: Array<{ from: string; to: string }>;
} {
	const nodes = new Map<string, { id: string; label: string; doc: string | null }>();
	const edges: Array<{ from: string; to: string }> = [];
	for (const line of source.split(/\r?\n/)) {
		const nodeMatch = /^\s*([A-Za-z0-9_]+)\["([\s\S]+)"\]/.exec(line);
		if (nodeMatch) {
			const id = nodeMatch[1];
			const labelParts = nodeMatch[2].split(/\\n/).map((part) => part.trim()).filter(Boolean);
			const doc = labelParts.find((part) => part.endsWith(".md")) ?? null;
			nodes.set(id, { id, label: labelParts[0] ?? id, doc });
			continue;
		}
		const edgeMatch = /^\s*([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/.exec(line);
		if (edgeMatch) edges.push({ from: edgeMatch[1], to: edgeMatch[2] });
	}
	return { nodes: Array.from(nodes.values()), edges };
}

function parseClassMembership(source: string, className: string): Set<string> {
	const set = new Set<string>();
	const pattern = new RegExp(`^\\s*class\\s+([^;]+)\\s+${className}\\s*;`, "gm");
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source))) {
		for (const id of match[1].split(",").map((part) => part.trim()).filter(Boolean)) set.add(id);
	}
	return set;
}

async function readMarkdownDoc(path: string): Promise<{
	frontmatter: Record<string, string>;
	sections: Array<{ title: string; body: string }>;
} | null> {
	if (!(await pathExists(path))) return null;
	const raw = await readText(path);
	const { frontmatter, body } = parseMarkdownFrontmatter(raw);
	return { frontmatter, sections: extractMarkdownSections(body) };
}

function parseMarkdownFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	if (!match) return { frontmatter: {}, body: raw };
	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const scalar = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!scalar) continue;
		frontmatter[scalar[1]] = scalar[2].replace(/^['"]|['"]$/g, "");
	}
	return { frontmatter, body: raw.slice(match[0].length) };
}

function extractMarkdownSections(body: string): Array<{ title: string; body: string }> {
	const sections: Array<{ title: string; body: string }> = [];
	const lines = body.split(/\r?\n/);
	let current: { title: string; body: string[] } | null = null;
	for (const line of lines) {
		const heading = /^##\s+(.+)$/.exec(line);
		if (heading) {
			if (current) sections.push({ title: current.title, body: compactSectionBody(current.body) });
			current = { title: heading[1].trim(), body: [] };
			continue;
		}
		if (current) current.body.push(line);
	}
	if (current) sections.push({ title: current.title, body: compactSectionBody(current.body) });
	return sections.filter((section) => section.body).slice(0, 6);
}

function compactSectionBody(lines: string[]): string {
	return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1400);
}

function normalizeGraphNode(node: any): Record<string, unknown> {
	return {
		id: String(node.id ?? node.path ?? "node"),
		kind: String(node.kind ?? "unknown"),
		label: String(node.title ?? node.label ?? node.path ?? node.id ?? "node"),
		path: node.path,
		layer: node.layer,
		state: node.state ?? node.status,
	};
}

function normalizeGraphEdge(edge: any): Record<string, unknown> {
	return {
		from: String(edge.from ?? ""),
		to: String(edge.to ?? ""),
		kind: String(edge.kind ?? "edge"),
		label: edge.label ?? edge.reason,
	};
}

async function readTextIfExists(path: string): Promise<string> {
	return (await pathExists(path)) ? readText(path) : "";
}

function stringOrNull(value: unknown): string | null {
	if (value === undefined || value === null || value === "") return null;
	return String(value);
}

function numberFrom(value: unknown): number {
	const number = Number(value ?? 0);
	return Number.isFinite(number) ? number : 0;
}

function uniqueSorted(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

const CONTROL_ROOM_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CodeWiki Control Room</title>
<link rel="stylesheet" href="/assets/control-room.css">
</head>
<body>
<div id="app" class="shell">
  <header class="topbar">
    <div>
      <span class="sigil">▣</span>
      <span class="title">CodeWiki Control Room</span>
      <span id="repo" class="muted"></span>
    </div>
    <div class="command">⌘ local-first · 127.0.0.1</div>
  </header>
  <nav class="rail" aria-label="Control Room sections">
    <button data-view="home" class="active">Home</button>
    <button data-view="system">System</button>
    <button data-view="graph">Graph</button>
    <button data-view="knowledge">Knowledge</button>
    <button data-view="board">Board</button>
    <button data-view="builds">Builds</button>
    <button data-view="validation">Validation</button>
    <button data-view="diff">Diff</button>
    <button data-view="settings">Settings</button>
  </nav>
  <main class="workspace">
    <section id="home" class="view active"></section>
    <section id="system" class="view"></section>
    <section id="graph" class="view"></section>
    <section id="knowledge" class="view placeholder"></section>
    <section id="board" class="view placeholder"></section>
    <section id="builds" class="view placeholder"></section>
    <section id="validation" class="view placeholder"></section>
    <section id="diff" class="view placeholder"></section>
    <section id="settings" class="view placeholder"></section>
  </main>
  <aside id="inspector" class="inspector"></aside>
  <footer id="status" class="status">booting control room…</footer>
</div>
<script src="/assets/control-room.js"></script>
</body>
</html>`;

const CONTROL_ROOM_CSS = String.raw`
:root {
  color-scheme: dark;
  --bg: #050807;
  --panel: #07110f;
  --panel2: #0b1815;
  --line: #1cff9a;
  --line-dim: rgba(28, 255, 154, 0.32);
  --cyan: #42f5ff;
  --amber: #ffcc66;
  --red: #ff5f6d;
  --text: #d8ffe8;
  --muted: #77a891;
  --shadow: rgba(28, 255, 154, 0.18);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    linear-gradient(rgba(255,255,255,0.025) 50%, rgba(0,0,0,0.08) 50%) 0 0 / 100% 4px,
    radial-gradient(circle at 25% 0%, rgba(66,245,255,0.11), transparent 32rem),
    var(--bg);
  color: var(--text);
  font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
button, select, input { font: inherit; }
.shell {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) 24rem;
  grid-template-rows: 3.2rem minmax(0, 1fr) 2.1rem;
  height: 100vh;
  gap: 1px;
  background: var(--line-dim);
}
.topbar, .rail, .workspace, .inspector, .status {
  background: rgba(5, 8, 7, 0.96);
}
.topbar {
  grid-column: 1 / 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid var(--line-dim);
  box-shadow: 0 0 24px var(--shadow);
}
.sigil, .title { color: var(--line); text-shadow: 0 0 10px var(--shadow); }
.title { font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.muted { color: var(--muted); }
.command { color: var(--cyan); }
.rail {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.rail button {
  color: var(--muted);
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  padding: 0.55rem 0.65rem;
  cursor: pointer;
}
.rail button:hover, .rail button.active {
  color: var(--text);
  border-color: var(--line-dim);
  background: rgba(28, 255, 154, 0.08);
  box-shadow: inset 0 0 18px rgba(28, 255, 154, 0.06);
}
.workspace { overflow: auto; padding: 1rem; }
.inspector { overflow: auto; padding: 1rem; border-left: 1px solid var(--line-dim); }
.status {
  grid-column: 1 / 4;
  padding: 0.35rem 1rem;
  color: var(--muted);
  border-top: 1px solid var(--line-dim);
}
.view { display: none; min-height: 100%; }
.view.active { display: block; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; }
.card, .terminal-panel {
  border: 1px solid var(--line-dim);
  background: linear-gradient(180deg, rgba(11, 24, 21, 0.95), rgba(4, 9, 8, 0.94));
  padding: 0.85rem;
  box-shadow: 0 0 18px rgba(28, 255, 154, 0.05);
}
.card h3, .terminal-panel h2, .terminal-panel h3 { margin: 0 0 0.55rem; color: var(--line); }
.big { font-size: 2rem; color: var(--cyan); }
.badge { display: inline-block; padding: 0.1rem 0.35rem; border: 1px solid var(--line-dim); color: var(--line); margin-right: 0.35rem; }
.badge.yellow { color: var(--amber); border-color: rgba(255, 204, 102, 0.45); }
.badge.red { color: var(--red); border-color: rgba(255, 95, 109, 0.45); }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 0 0 0.75rem; }
.toolbar select, .toolbar input {
  color: var(--text);
  background: #030605;
  border: 1px solid var(--line-dim);
  padding: 0.35rem 0.45rem;
}
.diagram, .graphmap { width: 100%; min-height: 32rem; border: 1px solid var(--line-dim); background: rgba(0,0,0,0.25); }
svg text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.node rect, .g-node circle { cursor: pointer; }
.node.selected rect { stroke: var(--cyan); stroke-width: 3; filter: drop-shadow(0 0 8px rgba(66,245,255,0.6)); }
.edge { stroke: rgba(66,245,255,0.45); stroke-width: 1.4; marker-end: url(#arrow); }
.g-edge { stroke: rgba(119,168,145,0.42); stroke-width: 1; cursor: pointer; }
.g-edge:hover, .g-edge.selected { stroke: var(--cyan); stroke-width: 2.5; filter: drop-shadow(0 0 5px rgba(66,245,255,0.75)); }
.g-node.selected circle { stroke: var(--cyan); stroke-width: 3; }
pre {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  border: 1px solid var(--line-dim);
  padding: 0.65rem;
  background: rgba(0,0,0,0.28);
}
a { color: var(--cyan); }
.placeholder::before { content: "▹ planned Control Room surface"; color: var(--amber); }
@media (max-width: 980px) {
  .shell { grid-template-columns: 1fr; grid-template-rows: auto auto 1fr auto auto; }
  .topbar, .status { grid-column: 1; }
  .rail { flex-direction: row; overflow-x: auto; }
  .inspector { border-left: 0; border-top: 1px solid var(--line-dim); max-height: 36vh; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; }
}
`;

const CONTROL_ROOM_JS = String.raw`
const state = { model: null, system: null, graph: null, selected: null };
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(url + ' -> ' + res.status);
  return res.json();
}

async function boot() {
  wireNav();
  try {
    const [model, system, graph] = await Promise.all([getJson('/api/state'), getJson('/api/system'), getJson('/api/graph')]);
    state.model = model; state.system = system; state.graph = graph;
    $('repo').textContent = ' :: ' + model.project.label;
    renderHome();
    renderSystem();
    renderGraph();
    renderPlaceholder('knowledge', 'Knowledge browser will navigate product/system specs with source paths.');
    renderPlaceholder('board', 'Board will show roadmap tasks, sprints, gates, evidence, and next action.');
    renderPlaceholder('builds', 'Builds will show compiler handoff timeline and consumes/produces edges.');
    renderPlaceholder('validation', 'Validation will show gates, failures, blockers, and policy-kept reports.');
    renderPlaceholder('diff', 'Diff will show pending feedback decisions and accepted rows.');
    renderPlaceholder('settings', 'Settings will show local server, repo, harness, and multi-computer state.');
    inspectHome();
    $('status').textContent = 'ready · graph ' + model.graph.nodes + ' nodes / ' + model.graph.edges + ' edges · local repo ' + model.project.root;
  } catch (err) {
    $('status').textContent = 'error · ' + err.message;
    $('home').innerHTML = '<div class="terminal-panel"><h2>Boot failed</h2><pre>' + esc(err.stack || err.message) + '</pre></div>';
  }
}

function wireNav() {
  document.querySelectorAll('.rail button').forEach((button) => {
    button.addEventListener('click', () => activateView(button.dataset.view));
  });
}

function activateView(view) {
  document.querySelectorAll('.rail button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === view));
  if (view === 'home') inspectHome();
  if (view === 'system' && state.system?.components?.[0]) inspectComponent(state.system.components[0].id);
  if (view === 'graph' && state.graph?.nodes?.[0]) inspectGraphNode(String(state.graph.nodes[0].id));
}

function renderHome() {
  const m = state.model;
  $('home').innerHTML = '<div class="grid">'
    + card('Health', '<span class="badge ' + healthClass(m.health.color) + '">' + esc(m.health.color) + '</span><div class="big">' + m.health.errors + '/' + m.health.warnings + '</div><div class="muted">errors / warnings</div>')
    + card('Roadmap', '<div class="big">' + m.roadmap.open + '</div><div>open tasks</div><div class="muted">next: ' + esc(m.roadmap.next || 'none') + '</div>')
    + card('Claims', '<div class="big">' + m.claims.active + '</div><div>active claims</div><div class="muted">conflicts: ' + m.claims.conflicts + '</div>')
    + card('Graph', '<div class="big">' + m.graph.nodes + '</div><div>nodes</div><div class="muted">edges: ' + m.graph.edges + '</div>')
    + '</div><div class="terminal-panel" style="margin-top:0.75rem"><h2>Next safe action</h2><p><span class="badge">' + esc(m.next_action.kind) + '</span>' + esc(m.next_action.summary) + '</p><pre>' + esc(m.next_action.command || 'Use the rail to inspect System or Graph.') + '</pre></div>';
}

function card(title, body) { return '<article class="card"><h3>' + esc(title) + '</h3>' + body + '</article>'; }
function healthClass(color) { return color === 'red' ? 'red' : color === 'yellow' ? 'yellow' : ''; }

function renderSystem() {
  const model = state.system;
  const controls = '<div class="toolbar"><span class="badge">' + esc(model.architecture_path) + '</span><span class="muted">click component → source-backed inspector</span></div>';
  $('system').innerHTML = controls + '<div id="systemDiagram" class="diagram"></div>';
  drawSystemDiagram(model);
}

function drawSystemDiagram(model) {
  const boxW = 170, boxH = 54, gapX = 235, gapY = 86;
  const ids = model.components.map((c) => c.id);
  const levels = computeLevels(ids, model.edges);
  const rowsByLevel = new Map();
  for (const id of ids) {
    const level = levels.get(id) || 0;
    if (!rowsByLevel.has(level)) rowsByLevel.set(level, []);
    rowsByLevel.get(level).push(id);
  }
  const pos = new Map();
  for (const [level, rowIds] of rowsByLevel) {
    rowIds.forEach((id, row) => pos.set(id, { x: 30 + level * gapX, y: 30 + row * gapY }));
  }
  const width = Math.max(720, 80 + (Math.max(...Array.from(levels.values()), 0) + 1) * gapX);
  const maxRows = Math.max(...Array.from(rowsByLevel.values()).map((r) => r.length), 1);
  const height = Math.max(420, 90 + maxRows * gapY);
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="CodeWiki architecture diagram"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(66,245,255,0.65)" /></marker></defs>';
  for (const edge of model.edges) {
    const a = pos.get(edge.from), b = pos.get(edge.to);
    if (!a || !b) continue;
    svg += '<line class="edge" x1="' + (a.x + boxW) + '" y1="' + (a.y + boxH/2) + '" x2="' + b.x + '" y2="' + (b.y + boxH/2) + '" />';
  }
  for (const c of model.components) {
    const p = pos.get(c.id); if (!p) continue;
    const fill = c.kind === 'component' ? 'rgba(28,255,154,0.09)' : 'rgba(66,245,255,0.07)';
    svg += '<g class="node" data-id="' + esc(c.id) + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + boxW + '" height="' + boxH + '" rx="6" fill="' + fill + '" stroke="rgba(28,255,154,0.45)" />'
      + '<text x="' + (p.x + 12) + '" y="' + (p.y + 24) + '" fill="#d8ffe8" font-size="13">' + esc(trim(c.title, 22)) + '</text>'
      + '<text x="' + (p.x + 12) + '" y="' + (p.y + 42) + '" fill="#77a891" font-size="11">' + esc(c.doc_path || c.kind) + '</text></g>';
  }
  svg += '</svg>';
  $('systemDiagram').innerHTML = svg;
  document.querySelectorAll('#systemDiagram .node').forEach((node) => node.addEventListener('click', () => inspectComponent(node.dataset.id)));
}

function computeLevels(ids, edges) {
  const levels = new Map(ids.map((id) => [id, 0]));
  for (let i = 0; i < ids.length; i++) {
    let changed = false;
    for (const edge of edges) {
      const next = (levels.get(edge.from) || 0) + 1;
      if (next > (levels.get(edge.to) || 0)) { levels.set(edge.to, next); changed = true; }
    }
    if (!changed) break;
  }
  return levels;
}

function inspectComponent(id) {
  state.selected = id;
  document.querySelectorAll('#systemDiagram .node').forEach((node) => node.classList.toggle('selected', node.dataset.id === id));
  const c = state.system.components.find((item) => item.id === id);
  if (!c) return;
  $('inspector').innerHTML = '<h2>' + esc(c.title) + '</h2><p>' + esc(c.summary) + '</p>'
    + '<p><span class="badge">' + esc(c.kind) + '</span>' + (c.state ? '<span class="badge">' + esc(c.state) + '</span>' : '') + '</p>'
    + '<pre>' + esc(c.doc_path || 'No source doc') + '</pre>'
    + c.sections.map((s) => '<h3>' + esc(s.title) + '</h3><pre>' + esc(s.body) + '</pre>').join('');
}

function renderGraph() {
  const model = state.graph;
  const nodeOptions = ['all'].concat(model.node_kinds).map((kind) => '<option value="' + esc(kind) + '">' + esc(kind) + '</option>').join('');
  const edgeOptions = ['all'].concat(model.edge_kinds).map((kind) => '<option value="' + esc(kind) + '">' + esc(kind) + '</option>').join('');
  $('graph').innerHTML = '<div class="toolbar"><label>node kind <select id="nodeKind">' + nodeOptions + '</select></label><label>edge kind <select id="edgeKind">' + edgeOptions + '</select></label><label>search <input id="graphSearch" placeholder="node id/path"></label><span class="badge">shown ' + model.stats.shown_nodes + '/' + model.stats.total_nodes + '</span></div><div id="graphMap" class="graphmap"></div>';
  $('nodeKind').addEventListener('change', drawGraphMap);
  $('edgeKind').addEventListener('change', drawGraphMap);
  $('graphSearch').addEventListener('input', drawGraphMap);
  drawGraphMap();
}

function drawGraphMap() {
  const model = state.graph;
  const nodeKind = $('nodeKind')?.value || 'all';
  const edgeKind = $('edgeKind')?.value || 'all';
  const query = ($('graphSearch')?.value || '').toLowerCase();
  const nodes = model.nodes.filter((node) => (nodeKind === 'all' || node.kind === nodeKind) && (!query || String(node.id + ' ' + (node.path || '') + ' ' + (node.label || '')).toLowerCase().includes(query))).slice(0, 120);
  const ids = new Set(nodes.map((node) => String(node.id)));
  const edges = model.edges.filter((edge) => ids.has(String(edge.from)) && ids.has(String(edge.to)) && (edgeKind === 'all' || edge.kind === edgeKind)).slice(0, 240);
  state.drawnEdges = edges;
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length || 1)));
  const cellW = 190, cellH = 82;
  const pos = new Map();
  nodes.forEach((node, i) => pos.set(String(node.id), { x: 40 + (i % cols) * cellW, y: 42 + Math.floor(i / cols) * cellH }));
  const width = Math.max(720, 90 + cols * cellW);
  const height = Math.max(420, 110 + Math.ceil((nodes.length || 1) / cols) * cellH);
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="CodeWiki generated graph">';
  edges.forEach((edge, index) => {
    const a = pos.get(String(edge.from)), b = pos.get(String(edge.to)); if (!a || !b) return;
    svg += '<line class="g-edge" data-edge="' + index + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" /><text x="' + ((a.x + b.x) / 2) + '" y="' + ((a.y + b.y) / 2 - 4) + '" fill="#77a891" font-size="9">' + esc(trim(edge.kind, 18)) + '</text>';
  });
  for (const node of nodes) {
    const p = pos.get(String(node.id));
    svg += '<g class="g-node" data-id="' + esc(node.id) + '"><circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="' + colorForKind(node.kind) + '" stroke="rgba(28,255,154,0.55)" />'
      + '<text x="' + (p.x + 24) + '" y="' + (p.y - 3) + '" fill="#d8ffe8" font-size="12">' + esc(trim(node.label || node.id, 24)) + '</text>'
      + '<text x="' + (p.x + 24) + '" y="' + (p.y + 13) + '" fill="#77a891" font-size="10">' + esc(node.kind) + '</text></g>';
  }
  svg += '</svg>';
  $('graphMap').innerHTML = svg;
  document.querySelectorAll('#graphMap .g-node').forEach((node) => node.addEventListener('click', () => inspectGraphNode(node.dataset.id)));
  document.querySelectorAll('#graphMap .g-edge').forEach((edge) => edge.addEventListener('click', () => inspectGraphEdge(Number(edge.dataset.edge))));
}

function inspectGraphNode(id) {
  document.querySelectorAll('#graphMap .g-node').forEach((node) => node.classList.toggle('selected', node.dataset.id === id));
  document.querySelectorAll('#graphMap .g-edge').forEach((edge) => edge.classList.remove('selected'));
  const node = state.graph.nodes.find((item) => String(item.id) === id);
  if (!node) return;
  const links = state.graph.edges.filter((edge) => edge.from === id || edge.to === id).slice(0, 20);
  $('inspector').innerHTML = '<h2>' + esc(node.label || node.id) + '</h2><p><span class="badge">' + esc(node.kind) + '</span></p><pre>' + esc(JSON.stringify(node, null, 2)) + '</pre><h3>Edges</h3><pre>' + esc(JSON.stringify(links, null, 2)) + '</pre>';
}

function inspectGraphEdge(index) {
  document.querySelectorAll('#graphMap .g-node').forEach((node) => node.classList.remove('selected'));
  document.querySelectorAll('#graphMap .g-edge').forEach((edge) => edge.classList.toggle('selected', Number(edge.dataset.edge) === index));
  const edge = state.drawnEdges?.[index];
  if (!edge) return;
  $('inspector').innerHTML = '<h2>Graph edge</h2><p><span class="badge">' + esc(edge.kind) + '</span></p><pre>' + esc(JSON.stringify(edge, null, 2)) + '</pre><p class="muted">Generated graph relationship. Use source paths and compiler loops for canonical changes.</p>';
}

function inspectHome() {
  const m = state.model;
  if (!m) return;
  $('inspector').innerHTML = '<h2>Current repo</h2><pre>' + esc(m.project.root) + '</pre><h3>Source contract</h3><p>Every view points back to .codewiki canonical truth or generated graph state.</p><p><span class="badge">local-first</span><span class="badge">retro terminal</span></p>';
}

function renderPlaceholder(id, text) {
  $(id).innerHTML = '<div class="terminal-panel"><h2>' + esc(id) + '</h2><p>' + esc(text) + '</p></div>';
}

function colorForKind(kind) {
  const value = String(kind || 'unknown');
  if (value.includes('task') || value.includes('roadmap')) return '#ffcc66';
  if (value.includes('build')) return '#42f5ff';
  if (value.includes('validation')) return '#ff5f6d';
  if (value.includes('doc') || value.includes('knowledge')) return '#1cff9a';
  return '#77a891';
}

function trim(value, max) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

boot();
`;
