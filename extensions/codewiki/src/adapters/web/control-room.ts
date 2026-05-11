import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { relative, resolve } from "node:path";
import type { WikiProject } from "../../domain/shared/types.ts";
import { maybeReadGraph, maybeReadRoadmapState, maybeReadStatusState } from "../../application/state-artifacts.ts";
import { maybeReadJson, pathExists, readText } from "../../infrastructure/filesystem.ts";

const nodeRequire = createRequire(import.meta.url);
let cytoscapeAssetCache: Promise<string> | null = null;

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
			case "/assets/vendor/cytoscape.min.js":
				writeTextResponse(res, 200, await readCytoscapeVendorAsset(), "text/javascript; charset=utf-8");
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

function readCytoscapeVendorAsset(): Promise<string> {
	cytoscapeAssetCache ??= readFile(nodeRequire.resolve("cytoscape/dist/cytoscape.min.js"), "utf8");
	return cytoscapeAssetCache;
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
    <button data-view="product">Product</button>
    <button data-view="system">System</button>
    <button data-view="graph">Graph</button>
    <button data-view="knowledge">Knowledge</button>
    <button data-view="roadmap">Roadmap</button>
    <button data-view="builds">Builds</button>
    <button data-view="validation">Validation</button>
    <button data-view="diff">Diff</button>
    <button data-view="settings">Settings</button>
  </nav>
  <main class="workspace">
    <section id="home" class="view active"></section>
    <section id="product" class="view"></section>
    <section id="system" class="view"></section>
    <section id="graph" class="view"></section>
    <section id="knowledge" class="view"></section>
    <section id="roadmap" class="view"></section>
    <section id="builds" class="view"></section>
    <section id="validation" class="view placeholder"></section>
    <section id="diff" class="view placeholder"></section>
    <section id="settings" class="view placeholder"></section>
  </main>
  <aside id="inspector" class="inspector"></aside>
  <footer id="status" class="status">booting control room…</footer>
</div>
<script src="/assets/vendor/cytoscape.min.js"></script>
<script src="/assets/control-room.js"></script>
</body>
</html>`;

const CONTROL_ROOM_CSS = String.raw`
:root {
  color-scheme: dark;
  --bg: #050604;
  --panel: #090b08;
  --panel2: #10140f;
  --line: #7f927f;
  --line-dim: rgba(180, 190, 172, 0.24);
  --highlight: #f4f1e8;
  --accent: #c7a35a;
  --accent-dim: rgba(199, 163, 90, 0.38);
  --red: #d46a66;
  --text: #dfddd2;
  --muted: #899488;
  --shadow: rgba(244, 241, 232, 0.10);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    linear-gradient(rgba(255,255,255,0.018) 50%, rgba(0,0,0,0.055) 50%) 0 0 / 100% 4px,
    radial-gradient(circle at 50% 0%, rgba(244,241,232,0.055), transparent 34rem),
    var(--bg);
  color: var(--text);
  font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
button, select, input { font: inherit; }
button { color: inherit; }
.shell {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) 24rem;
  grid-template-rows: 3.2rem minmax(0, 1fr) 2.1rem;
  height: 100vh;
  gap: 1px;
  background: var(--line-dim);
}
.topbar, .rail, .workspace, .inspector, .status {
  background: rgba(5, 6, 4, 0.97);
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
.sigil, .title { color: var(--highlight); text-shadow: 0 0 10px var(--shadow); }
.title { font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.muted { color: var(--muted); }
.command { color: var(--accent); }
.rail {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  color: var(--highlight);
  border-color: var(--line-dim);
  background: rgba(244, 241, 232, 0.055);
  box-shadow: inset 0 0 18px rgba(244, 241, 232, 0.045);
}
.workspace { overflow: auto; padding: 0.75rem; }
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
.card, .area-card, .source-card, .empty-state {
  border: 1px solid var(--line-dim);
  background: linear-gradient(180deg, rgba(16, 20, 15, 0.86), rgba(5, 6, 4, 0.72));
  padding: 0.85rem;
  box-shadow: 0 0 16px rgba(244, 241, 232, 0.035);
}
.card h3, .area-card h3, .source-card h3, .section-head h2, .empty-state h2 { margin: 0 0 0.55rem; color: var(--highlight); }
.big { font-size: 2rem; color: var(--highlight); }
.badge { display: inline-block; padding: 0.1rem 0.35rem; border: 1px solid var(--line-dim); color: var(--highlight); margin-right: 0.35rem; }
.badge.yellow { color: var(--accent); border-color: var(--accent-dim); }
.badge.red { color: var(--red); border-color: rgba(212, 106, 102, 0.45); }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 0 0 0.6rem; }
.toolbar select, .toolbar input, .toolbar button {
  color: var(--text);
  background: #050604;
  border: 1px solid var(--line-dim);
  padding: 0.35rem 0.45rem;
}
.toolbar button { cursor: pointer; }
.toolbar button:hover { color: var(--highlight); border-color: var(--highlight); }
.section-head { margin: 0 0 0.75rem; }
.section-head p { margin: 0.25rem 0 0; color: var(--muted); }
.area-map { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.75rem; margin-top: 0.75rem; }
.area-card { width: 100%; min-height: 8rem; text-align: left; cursor: pointer; }
.area-card:hover, .area-card.active { border-color: var(--highlight); background: rgba(244, 241, 232, 0.055); }
.area-card .glyph { color: var(--accent); font-size: 1.1rem; }
.source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; }
.source-card code, pre code { color: var(--highlight); }
.canvas { width: 100%; min-height: calc(100vh - 7.2rem); overflow: auto; background: transparent; }
.diagram { width: 100%; min-height: calc(100vh - 7.2rem); overflow: auto; background: transparent; }
.graphmap {
  width: 100%;
  min-height: calc(100vh - 7.2rem);
  height: calc(100vh - 7.2rem);
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, rgba(244,241,232,0.035), transparent 28rem),
    rgba(0,0,0,0.12);
  border: 1px solid var(--line-dim);
}
.graphmap canvas { outline: none; }
.cy-error { border: 1px solid rgba(212,106,102,0.45); color: var(--red); padding: 1rem; }
svg text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.node rect, .g-node circle, .g-edge { cursor: pointer; }
.node.selected rect { stroke: var(--highlight); stroke-width: 3; filter: drop-shadow(0 0 8px rgba(244,241,232,0.45)); }
.edge { fill: none; stroke: rgba(180,190,172,0.42); stroke-width: 1.35; marker-end: url(#arrow); }
.edge:hover, .edge.selected { stroke: var(--highlight); stroke-width: 2.4; }
.g-edge { stroke: rgba(137,148,136,0.36); stroke-width: 1; }
.g-edge:hover, .g-edge.selected { stroke: var(--highlight); stroke-width: 2.5; filter: drop-shadow(0 0 5px rgba(244,241,232,0.42)); }
.g-node.selected circle { stroke: var(--highlight); stroke-width: 3; }
pre {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  border: 1px solid var(--line-dim);
  padding: 0.65rem;
  background: rgba(0,0,0,0.22);
}
a { color: var(--highlight); }
.empty-state { color: var(--muted); }
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
const state = { model: null, system: null, graph: null, selected: null, systemZoom: 0.92, graphZoom: 1, drawnEdges: [], cy: null };
const GRAPH_FIT_PADDING = 72;
const GRAPH_LAYOUT_SPACING = 180;
const GRAPH_NODE_REPULSION = 26000;
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

const AREAS = [
  { id: 'product', label: 'Product', glyph: '◇', summary: 'User intent, stories, visual UI expectations, and product non-goals.', sources: ['.codewiki/kb/product/overview.md', '.codewiki/kb/product/users/**', '.codewiki/kb/product/stories/**', '.codewiki/kb/product/uis/**'] },
  { id: 'system', label: 'System', glyph: '▧', summary: 'Architecture, API, adapters, package boundaries, and implementation seams.', sources: ['.codewiki/kb/system/architecture.mmd', '.codewiki/kb/system/overview.md', '.codewiki/kb/system/*.md'] },
  { id: 'graph', label: 'Graph', glyph: '✣', summary: 'Generated relationship map, drift signals, lenses, and next action routing.', sources: ['.codewiki/index_graph.json', '.codewiki/kb/system/graph.md'] },
  { id: 'knowledge', label: 'Knowledge', glyph: '▤', summary: 'Canonical repo-local intended truth under product and system knowledge.', sources: ['.codewiki/kb/**', '.codewiki/kb/lexicon.md'] },
  { id: 'roadmap', label: 'Roadmap', glyph: '▦', summary: 'Executable delta from intent to implementation, including tasks and closure evidence.', sources: ['.codewiki/roadmap.json', '.codewiki/kb/system/roadmap.md'] },
  { id: 'builds', label: 'Builds', glyph: '▣', summary: 'Feedback, documentation, and implementation handoff artifacts.', sources: ['.codewiki/builds/**', '.codewiki/kb/system/builds.md'] },
  { id: 'validation', label: 'Validation', glyph: '✓', summary: 'Gateway verdicts, failures, blockers, and policy-kept reports.', sources: ['.codewiki/validation/**', '.codewiki/kb/system/validation-gateway.md'] },
  { id: 'diff', label: 'Diff', glyph: '↯', summary: 'Pending feedback decision tables and accepted user intent deltas.', sources: ['.codewiki/runtime/diff-tables.json'] },
  { id: 'settings', label: 'Settings', glyph: '⚙', summary: 'Repo config, local UI host, harness surface, and local-first runtime preferences.', sources: ['.codewiki/config.json', '~/.pi/codewiki-status-prefs.json'] },
];

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
    renderAreaView('product');
    renderSystem();
    renderGraph();
    ['knowledge', 'roadmap', 'builds', 'validation', 'diff', 'settings'].forEach(renderAreaView);
    inspectHome();
    $('status').textContent = 'ready · graph ' + model.graph.nodes + ' nodes / ' + model.graph.edges + ' edges · local repo ' + model.project.root;
  } catch (err) {
    $('status').textContent = 'error · ' + err.message;
    $('home').innerHTML = '<div class="empty-state"><h2>Boot failed</h2><pre>' + esc(err.stack || err.message) + '</pre></div>';
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
  else if (view === 'system' && state.system?.components?.[0]) inspectComponent(state.system.components[0].id);
  else if (view === 'graph' && state.graph?.nodes?.[0]) inspectGraphNode(String(state.graph.nodes[0].id));
  else inspectArea(view);
}

function renderHome() {
  const m = state.model;
  $('home').innerHTML = '<div class="section-head"><h2>Mission briefing</h2><p>CodeWiki as local-first control room. Pick an area to inspect canonical truth.</p></div><div class="grid">'
    + card('Health', '<span class="badge ' + healthClass(m.health.color) + '">' + esc(m.health.color) + '</span><div class="big">' + m.health.errors + '/' + m.health.warnings + '</div><div class="muted">errors / warnings</div>')
    + card('Roadmap', '<div class="big">' + m.roadmap.open + '</div><div>open tasks</div><div class="muted">next: ' + esc(m.roadmap.next || 'none') + '</div>')
    + card('Claims', '<div class="big">' + m.claims.active + '</div><div>active claims</div><div class="muted">conflicts: ' + m.claims.conflicts + '</div>')
    + card('Graph', '<div class="big">' + m.graph.nodes + '</div><div>nodes</div><div class="muted">edges: ' + m.graph.edges + '</div>')
    + '</div><div class="section-head" style="margin-top:1rem"><h2>CodeWiki map</h2><p>Major product/system surfaces. Each card points back to source files.</p></div>'
    + renderAreaCards()
    + '<div class="empty-state" style="margin-top:0.75rem"><h2>Next safe action</h2><p><span class="badge">' + esc(m.next_action.kind) + '</span>' + esc(m.next_action.summary) + '</p><pre>' + esc(m.next_action.command || 'Use the rail to inspect System or Graph.') + '</pre></div>';
  wireAreaCards();
}

function card(title, body) { return '<article class="card"><h3>' + esc(title) + '</h3>' + body + '</article>'; }
function healthClass(color) { return color === 'red' ? 'red' : color === 'yellow' ? 'yellow' : ''; }

function renderAreaCards(activeId) {
  return '<div class="area-map">' + AREAS.map((area) => '<button class="area-card' + (area.id === activeId ? ' active' : '') + '" data-area="' + esc(area.id) + '"><div class="glyph">' + esc(area.glyph) + '</div><h3>' + esc(area.label) + '</h3><p>' + esc(area.summary) + '</p><p class="muted">' + esc(area.sources[0]) + '</p></button>').join('') + '</div>';
}

function wireAreaCards() {
  document.querySelectorAll('.area-card').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.area;
      if (id === 'system' || id === 'graph' || id === 'product') activateView(id);
      else activateView(id);
      inspectArea(id);
    });
  });
}

function renderAreaView(id) {
  const area = areaById(id);
  if (!area || id === 'system' || id === 'graph') return;
  const sourceCards = area.sources.map((source) => '<article class="source-card"><h3>source</h3><code>' + esc(source) + '</code></article>').join('');
  $(id).innerHTML = '<div class="section-head"><h2>' + esc(area.glyph + ' ' + area.label) + '</h2><p>' + esc(area.summary) + '</p></div>' + renderAreaCards(id) + '<div class="section-head" style="margin-top:1rem"><h2>Source anchors</h2><p>UI representation stays tied to canonical or generated CodeWiki files.</p></div><div class="source-grid">' + sourceCards + '</div>';
  wireAreaCards();
}

function areaById(id) { return AREAS.find((area) => area.id === id); }

function inspectArea(id) {
  const area = areaById(id);
  if (!area) return;
  document.querySelectorAll('.area-card').forEach((button) => button.classList.toggle('active', button.dataset.area === id));
  $('inspector').innerHTML = '<h2>' + esc(area.glyph + ' ' + area.label) + '</h2><p>' + esc(area.summary) + '</p><h3>Source anchors</h3><pre>' + esc(area.sources.join('\n')) + '</pre><p class="muted">Representation only. Canonical truth remains in source files and graph state.</p>';
}

function renderSystem() {
  const model = state.system;
  const controls = '<div class="toolbar"><span class="badge">' + esc(model.architecture_path) + '</span><span class="muted">click component → source-backed inspector</span><button data-zoom="system:out">−</button><button data-zoom="system:in">+</button><button data-zoom="system:fit">fit</button><button data-zoom="system:reset">reset</button></div>';
  $('system').innerHTML = controls + '<div id="systemDiagram" class="diagram canvas"></div>';
  wireZoomControls();
  drawSystemDiagram(model);
}

function drawSystemDiagram(model) {
  const layout = layoutSystem(model.components);
  const boxW = layout.boxW, boxH = layout.boxH;
  let svg = '<svg width="' + Math.round(layout.width * state.systemZoom) + '" height="' + Math.round(layout.height * state.systemZoom) + '" viewBox="0 0 ' + layout.width + ' ' + layout.height + '" role="img" aria-label="CodeWiki architecture diagram"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#c7a35a" /></marker></defs>';
  for (const lane of layout.lanes) svg += '<text x="' + lane.x + '" y="22" fill="#899488" font-size="11">' + esc(lane.label) + '</text>';
  model.edges.forEach((edge, index) => {
    const a = layout.pos.get(edge.from), b = layout.pos.get(edge.to);
    if (!a || !b) return;
    svg += '<path class="edge" data-edge="' + index + '" d="' + routeEdge(a, b, boxW, boxH) + '" />';
  });
  for (const c of model.components) {
    const p = layout.pos.get(c.id); if (!p) continue;
    const fill = c.kind === 'component' ? 'rgba(180,190,172,0.10)' : 'rgba(199,163,90,0.08)';
    svg += '<g class="node" data-id="' + esc(c.id) + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + boxW + '" height="' + boxH + '" rx="4" fill="' + fill + '" stroke="rgba(180,190,172,0.42)" />'
      + '<text x="' + (p.x + 12) + '" y="' + (p.y + 25) + '" fill="#f4f1e8" font-size="13">' + esc(trim(c.title, 24)) + '</text>'
      + '<text x="' + (p.x + 12) + '" y="' + (p.y + 44) + '" fill="#899488" font-size="10">' + esc(c.doc_path || c.kind) + '</text></g>';
  }
  svg += '</svg>';
  $('systemDiagram').innerHTML = svg;
  document.querySelectorAll('#systemDiagram .node').forEach((node) => node.addEventListener('click', () => inspectComponent(node.dataset.id)));
  document.querySelectorAll('#systemDiagram .edge').forEach((edge) => edge.addEventListener('click', () => inspectSystemEdge(Number(edge.dataset.edge))));
}

function layoutSystem(components) {
  const boxW = 205, boxH = 62, colW = 260, rowH = 108, marginX = 34, marginY = 44;
  const manual = {
    User: [0, 2],
    ControlRoom: [1, 1], Extension: [1, 3],
    Adapters: [2, 3],
    API: [3, 2],
    Agency: [4, 0], Compilers: [4, 2], Gateway: [4, 4],
    Knowledge: [5, 0], Builds: [5, 1.35], Roadmap: [5, 2.7], CodeTests: [5, 4.05],
    Graph: [6, 1.35],
    Publication: [7, 2.7]
  };
  const pos = new Map();
  let fallback = 0;
  for (const c of components) {
    const pair = manual[c.id] || [2 + (fallback % 4), 5.2 + Math.floor(fallback / 4)];
    if (!manual[c.id]) fallback++;
    pos.set(c.id, { x: marginX + pair[0] * colW, y: marginY + pair[1] * rowH });
  }
  const values = Array.from(pos.values());
  const width = Math.max(980, Math.max(...values.map((p) => p.x)) + boxW + marginX);
  const height = Math.max(650, Math.max(...values.map((p) => p.y)) + boxH + marginY);
  const lanes = [
    { x: marginX, label: 'intent' },
    { x: marginX + colW, label: 'surface' },
    { x: marginX + 2 * colW, label: 'adapter' },
    { x: marginX + 3 * colW, label: 'api' },
    { x: marginX + 4 * colW, label: 'loops' },
    { x: marginX + 5 * colW, label: 'truth' },
    { x: marginX + 6 * colW, label: 'state' },
    { x: marginX + 7 * colW, label: 'output' }
  ];
  return { pos, lanes, boxW, boxH, width, height };
}

function routeEdge(a, b, boxW, boxH) {
  const forward = b.x > a.x + 8;
  const sameColumn = Math.abs(b.x - a.x) <= 8;
  const sx = forward || sameColumn ? a.x + boxW : a.x;
  const sy = a.y + boxH / 2;
  const ex = forward ? b.x : sameColumn ? b.x + boxW : b.x + boxW;
  const ey = b.y + boxH / 2;
  const midX = sameColumn ? sx + 42 : (sx + ex) / 2;
  return 'M ' + sx + ' ' + sy + ' H ' + midX + ' V ' + ey + ' H ' + ex;
}

function inspectComponent(id) {
  state.selected = id;
  document.querySelectorAll('#systemDiagram .node').forEach((node) => node.classList.toggle('selected', node.dataset.id === id));
  document.querySelectorAll('#systemDiagram .edge').forEach((edge) => edge.classList.remove('selected'));
  const c = state.system.components.find((item) => item.id === id);
  if (!c) return;
  $('inspector').innerHTML = '<h2>' + esc(c.title) + '</h2><p>' + esc(c.summary) + '</p>'
    + '<p><span class="badge">' + esc(c.kind) + '</span>' + (c.state ? '<span class="badge">' + esc(c.state) + '</span>' : '') + '</p>'
    + '<pre>' + esc(c.doc_path || 'No source doc') + '</pre>'
    + c.sections.map((s) => '<h3>' + esc(s.title) + '</h3><pre>' + esc(s.body) + '</pre>').join('');
}

function inspectSystemEdge(index) {
  document.querySelectorAll('#systemDiagram .node').forEach((node) => node.classList.remove('selected'));
  document.querySelectorAll('#systemDiagram .edge').forEach((edge) => edge.classList.toggle('selected', Number(edge.dataset.edge) === index));
  const edge = state.system.edges[index];
  if (!edge) return;
  $('inspector').innerHTML = '<h2>Architecture edge</h2><p><span class="badge">' + esc(edge.kind) + '</span></p><pre>' + esc(edge.from + ' -> ' + edge.to) + '</pre><p class="muted">Source: ' + esc(state.system.architecture_path) + '</p>';
}

function renderGraph() {
  const model = state.graph;
  const nodeOptions = ['all'].concat(model.node_kinds).map((kind) => '<option value="' + esc(kind) + '">' + esc(kind) + '</option>').join('');
  const edgeOptions = ['all'].concat(model.edge_kinds).map((kind) => '<option value="' + esc(kind) + '">' + esc(kind) + '</option>').join('');
  $('graph').innerHTML = '<div class="toolbar"><label>scope <select id="graphScope"><option value="core">core</option><option value="all">all</option></select></label><label>node kind <select id="nodeKind">' + nodeOptions + '</select></label><label>edge kind <select id="edgeKind">' + edgeOptions + '</select></label><label>search <input id="graphSearch" placeholder="node id/path"></label><button data-zoom="graph:out">−</button><button data-zoom="graph:in">+</button><button data-zoom="graph:fit">fit</button><button data-zoom="graph:reset">reset</button><span id="graphStats" class="badge">shown ' + model.stats.shown_nodes + '/' + model.stats.total_nodes + '</span></div><div id="graphMap" class="graphmap canvas"></div>';
  $('graphScope').addEventListener('change', drawGraphMap);
  $('nodeKind').addEventListener('change', drawGraphMap);
  $('edgeKind').addEventListener('change', drawGraphMap);
  $('graphSearch').addEventListener('input', drawGraphMap);
  wireZoomControls();
  drawGraphMap();
}

function drawGraphMap() {
  const container = $('graphMap');
  const model = state.graph;
  const scope = $('graphScope')?.value || 'core';
  const nodeKind = $('nodeKind')?.value || 'all';
  const edgeKind = $('edgeKind')?.value || 'all';
  const query = ($('graphSearch')?.value || '').toLowerCase();
  const maxNodes = scope === 'all' ? 150 : 75;
  const nodes = model.nodes.filter((node) => (scope === 'all' || isCoreGraphNode(node)) && (nodeKind === 'all' || node.kind === nodeKind) && (!query || String(node.id + ' ' + (node.path || '') + ' ' + (node.label || '')).toLowerCase().includes(query))).slice(0, maxNodes);
  const ids = new Set(nodes.map((node) => String(node.id)));
  const edges = model.edges.filter((edge) => ids.has(String(edge.from)) && ids.has(String(edge.to)) && (edgeKind === 'all' || edge.kind === edgeKind)).slice(0, scope === 'all' ? 280 : 150);
  state.drawnEdges = edges;
  $('graphStats').textContent = 'shown ' + nodes.length + '/' + model.stats.total_nodes + ' · edges ' + edges.length + '/' + model.stats.total_edges + ' · cytoscape';
  destroyGraphRenderer();
  if (!container) return;
  container.innerHTML = '';
  if (!window.cytoscape) {
    container.innerHTML = '<div class="cy-error"><h2>Graph renderer unavailable</h2><p>Cytoscape.js did not load from the local vendor asset.</p><pre>/assets/vendor/cytoscape.min.js</pre></div>';
    return;
  }
  const cy = window.cytoscape({
    container,
    elements: buildCytoscapeElements(nodes, edges),
    wheelSensitivity: 0.18,
    minZoom: 0.05,
    maxZoom: 2.8,
    style: createGraphStyle(),
    layout: layoutForGraph(nodes, edges),
  });
  state.cy = cy;
  cy.on('tap', 'node', (event) => inspectGraphNode(String(event.target.data('id'))));
  cy.on('tap', 'edge', (event) => inspectGraphEdge(Number(event.target.data('index'))));
  cy.one('layoutstop', () => fitGraph(cy));
  cy.ready(() => {
    fitGraph(cy);
    window.requestAnimationFrame(() => fitGraph(cy));
  });
}

function destroyGraphRenderer() {
  if (state.cy) {
    state.cy.destroy();
    state.cy = null;
  }
}

function fitGraph(cy) {
  cy.fit(cy.elements(), GRAPH_FIT_PADDING);
}

function buildCytoscapeElements(nodes, edges) {
  const elements = [];
  for (const node of nodes) {
    const id = String(node.id);
    elements.push({
      group: 'nodes',
      data: {
        id,
        kind: String(node.kind || 'unknown'),
        label: String(node.label || node.path || node.id || 'node'),
        displayLabel: trim(node.label || node.path || node.id, 28),
        path: node.path || '',
        color: colorForKind(node.kind),
      },
    });
  }
  edges.forEach((edge, index) => {
    elements.push({
      group: 'edges',
      data: {
        id: 'edge:' + index + ':' + edge.from + '->' + edge.to,
        source: String(edge.from),
        target: String(edge.to),
        kind: String(edge.kind || 'edge'),
        displayKind: trim(edge.kind || 'edge', 18),
        label: edge.label || '',
        index,
      },
    });
  });
  return elements;
}

function createGraphStyle() {
  return [
    {
      selector: 'core',
      style: { 'active-bg-color': '#f4f1e8', 'active-bg-opacity': 0.08, 'selection-box-color': '#f4f1e8', 'selection-box-opacity': 0.08, 'selection-box-border-color': '#f4f1e8' },
    },
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'border-color': '#b4beac',
        'border-opacity': 0.5,
        'border-width': 1.4,
        'color': '#f4f1e8',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        'font-size': 10,
        'height': 26,
        'label': 'data(displayLabel)',
        'min-zoomed-font-size': 6,
        'overlay-color': '#f4f1e8',
        'overlay-opacity': 0.04,
        'shape': 'round-rectangle',
        'text-background-color': '#050604',
        'text-background-opacity': 0.72,
        'text-background-padding': 2,
        'text-halign': 'right',
        'text-margin-x': 8,
        'text-valign': 'center',
        'width': 26,
      },
    },
    {
      selector: 'edge',
      style: {
        'color': '#899488',
        'curve-style': 'bezier',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        'font-size': 8,
        'label': 'data(displayKind)',
        'line-color': '#899488',
        'min-zoomed-font-size': 7,
        'opacity': 0.64,
        'target-arrow-color': '#c7a35a',
        'target-arrow-shape': 'triangle',
        'text-background-color': '#050604',
        'text-background-opacity': 0.7,
        'text-background-padding': 1,
        'text-rotation': 'autorotate',
        'width': 1.1,
      },
    },
    {
      selector: 'node:selected',
      style: { 'border-color': '#f4f1e8', 'border-width': 4, 'color': '#f4f1e8' },
    },
    {
      selector: 'edge:selected',
      style: { 'line-color': '#f4f1e8', 'opacity': 1, 'target-arrow-color': '#f4f1e8', 'width': 2.6 },
    },
  ];
}

function layoutForGraph(nodes, edges) {
  if (nodes.length <= 8) {
    return { name: 'circle', fit: true, padding: GRAPH_FIT_PADDING, avoidOverlap: true, nodeDimensionsIncludeLabels: true, spacingFactor: 1.8 };
  }
  if (edges.length === 0) {
    return { name: 'grid', fit: true, padding: GRAPH_FIT_PADDING, avoidOverlap: true, nodeDimensionsIncludeLabels: true, spacingFactor: 2.1 };
  }
  return {
    name: 'cose',
    animate: false,
    componentSpacing: GRAPH_LAYOUT_SPACING,
    coolingFactor: 0.96,
    edgeElasticity: 48,
    fit: true,
    gravity: 0.08,
    idealEdgeLength: GRAPH_LAYOUT_SPACING,
    initialTemp: 300,
    minTemp: 1,
    nestingFactor: 1.0,
    nodeDimensionsIncludeLabels: true,
    nodeOverlap: 72,
    nodeRepulsion: GRAPH_NODE_REPULSION,
    numIter: 1400,
    padding: GRAPH_FIT_PADDING,
    randomize: true,
  };
}

function isCoreGraphNode(node) {
  const id = String(node.id || '');
  const kind = String(node.kind || '');
  if (kind.includes('code_path') || id.startsWith('code:')) return false;
  if (id.includes('/builds/') && !id.includes('2026-05-11')) return false;
  return true;
}

function inspectGraphNode(id) {
  if (state.cy) {
    state.cy.elements().unselect();
    const selected = state.cy.getElementById(id);
    if (selected?.length) selected.select();
  }
  const node = state.graph.nodes.find((item) => String(item.id) === id);
  if (!node) return;
  const links = state.graph.edges.filter((edge) => edge.from === id || edge.to === id).slice(0, 20);
  $('inspector').innerHTML = '<h2>' + esc(node.label || node.id) + '</h2><p><span class="badge">' + esc(node.kind) + '</span></p><pre>' + esc(JSON.stringify(node, null, 2)) + '</pre><h3>Edges</h3><pre>' + esc(JSON.stringify(links, null, 2)) + '</pre>';
}

function inspectGraphEdge(index) {
  if (state.cy) {
    state.cy.elements().unselect();
    const selected = state.cy.edges().filter((edge) => Number(edge.data('index')) === index);
    if (selected.length) selected.select();
  }
  const edge = state.drawnEdges?.[index];
  if (!edge) return;
  $('inspector').innerHTML = '<h2>Graph edge</h2><p><span class="badge">' + esc(edge.kind) + '</span></p><pre>' + esc(JSON.stringify(edge, null, 2)) + '</pre><p class="muted">Generated graph relationship. Use source paths and compiler loops for canonical changes.</p>';
}

function wireZoomControls() {
  document.querySelectorAll('[data-zoom]').forEach((button) => {
    button.onclick = () => {
      const [target, action] = button.dataset.zoom.split(':');
      if (target === 'system') {
        state.systemZoom = nextZoom(state.systemZoom, action, 0.78, 1);
        drawSystemDiagram(state.system);
      }
      if (target === 'graph') {
        controlGraphViewport(action);
      }
    };
  });
}

function controlGraphViewport(action) {
  if (!state.cy) {
    state.graphZoom = nextZoom(state.graphZoom, action, 0.68, 1);
    drawGraphMap();
    return;
  }
  if (action === 'fit') { fitGraph(state.cy); return; }
  if (action === 'reset') { state.cy.reset(); fitGraph(state.cy); return; }
  const box = state.cy.container().getBoundingClientRect();
  const renderedPosition = { x: box.width / 2, y: box.height / 2 };
  const factor = action === 'in' ? 1.18 : 1 / 1.18;
  const level = Math.max(state.cy.minZoom(), Math.min(state.cy.maxZoom(), state.cy.zoom() * factor));
  state.cy.zoom({ level, renderedPosition });
}

function nextZoom(current, action, fitValue, resetValue) {
  if (action === 'in') return Math.min(1.8, Math.round((current + 0.12) * 100) / 100);
  if (action === 'out') return Math.max(0.45, Math.round((current - 0.12) * 100) / 100);
  if (action === 'fit') return fitValue;
  return resetValue;
}

function inspectHome() {
  const m = state.model;
  if (!m) return;
  $('inspector').innerHTML = '<h2>Current repo</h2><pre>' + esc(m.project.root) + '</pre><h3>Source contract</h3><p>Every view points back to .codewiki canonical truth or generated graph state.</p><p><span class="badge">local-first</span><span class="badge">retro terminal</span></p>';
}

function colorForKind(kind) {
  const value = String(kind || 'unknown');
  if (value.includes('task') || value.includes('roadmap')) return '#c7a35a';
  if (value.includes('build')) return '#a7a06d';
  if (value.includes('validation')) return '#d46a66';
  if (value.includes('doc') || value.includes('knowledge')) return '#f4f1e8';
  return '#7f927f';
}

function trim(value, max) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

boot();
`;
