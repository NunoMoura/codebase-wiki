---
id: spec.system.control-room-ui
title: Control Room UI
state: active
summary: Standalone local web UI and hosting surface for the simplified CodeWiki control room.
owners:
  - architecture
  - engineering
updated: "2026-05-12"
code_paths:
  - extensions/codewiki/src/adapters/web
  - extensions/codewiki/src/adapters/pi/commands
  - extensions/codewiki/src/application
  - extensions/codewiki/src/infrastructure
---

# Control Room UI

## Responsibility

The Control Room UI is the standalone local web surface for CodeWiki. It serves a browser-based second-screen command center for the current repository, renders curated product and system views, visualizes generated graph relationships, and delegates semantic reads and writes to the CodeWiki API.

The Control Room is a product UI and an access surface. It must not own CodeWiki truth. Product intent remains in `.codewiki/kb/**`, work truth remains in roadmap state, compiler handoffs remain in builds, validation truth remains in validation reports, coordination state remains in runtime claims, and generated relationships remain in `.codewiki/index_graph.json`.

The Control Room should prioritize high-signal navigation over exhaustive artifact browsing. The first-level UI sections are `Status`, `Product`, `System`, `Board`, and `Graph`. Knowledge documents, builds, validation reports, feedback diff rows, and settings remain accessible through contextual inspectors, command-palette actions, API/chat workflows, and source paths rather than permanent top-level views.

## Local hosting model

The default hosting model is local-first:

```text
codewiki ui or harness launcher
  -> local HTTP server on 127.0.0.1:<port>
    -> browser Control Room
      -> CodeWiki API/application capabilities
        -> repo-local .codewiki files, graph state, code paths, and git metadata
```

The server should bind to `127.0.0.1` by default, choose an available port, attempt to open the local URL in the system browser when launched from an interactive host, and always print a plain `http://127.0.0.1:<port>/` fallback. It should not require hosted infrastructure, accounts, or internet access.

Optional shared LAN/server mode may be added later with an explicit flag, token authentication, and clear warnings. It must never be the default.

## Harness integration

Harnesses launch or connect to the Control Room; they do not fork the UI semantics.

| Harness or access surface | Expected role |
| --- | --- |
| Pi | Provide a command or shortcut that launches the local Control Room, attempts to open the local URL in the browser, prints a plain URL fallback, and keeps the compact TUI status panel as a fallback. |
| CLI | Start the local server and print or open the URL. |
| MCP | Expose the same API capabilities for non-visual agent access. |
| Claude Code | Launch through CLI or MCP when implemented. |
| Codex | Launch through CLI or MCP when implemented. |
| Editors | Open the local URL or embed it when a real integration exists. |

## API contract

The Control Room should use typed CodeWiki API capabilities or thin HTTP endpoints over those capabilities. Minimum read endpoints for the simplified UI are:

- repository status, health, graph/task metrics, and next action,
- current session/focus summary,
- roadmap summary, active task/sprint scope, gates, blockers, and closure evidence,
- product summary derived from `.codewiki/kb/product/**`, including users, stories, and UI surfaces,
- generated graph state and scoped graph slices,
- system diagram catalog and selected diagram raw data from `.codewiki/kb/system/diagrams/**`,
- system component document summaries from `.codewiki/kb/system/*.md`,
- active change claims,
- contextual build, validation, diff-table, or settings detail only when linked from the active view.

Write endpoints should be added only when the view needs a real action. They must route through existing application use cases such as feedback diff-table actions, roadmap task actions, claim actions, build writing, validation writing, and graph rebuilds.

## Product view contract

The Product view reads `.codewiki/kb/product/**` and presents a curated product model rather than raw Markdown as the default UI.

The read model should extract:

- users and their jobs,
- stories and acceptance/success signals,
- visual UI surfaces and their purpose,
- links between users, stories, UIs, roadmap tasks, builds, validation reports, and evidence when the graph exposes them,
- source paths for every displayed fact.

Raw Markdown can appear in the inspector or source preview, but the main Product workspace should be cards, relationships, and concise summaries.

## System view contract

The System view reads component docs from `.codewiki/kb/system/*.md` and diagram raw data from `.codewiki/kb/system/diagrams/**`.

The UI should expose a diagram picker for the five core diagram families:

| Diagram kind | Canonical source | Renderer target |
| --- | --- | --- |
| Context map | YAML graph spec with actors, systems, and relationships. | Graph/SVG or Mermaid flowchart. |
| Component/container map | YAML graph spec with groups, nodes, edges, and source docs. | Cytoscape/custom SVG or Mermaid flowchart. |
| Key flow sequence | YAML sequence spec with participants and ordered messages. | Mermaid sequence diagram or custom sequence renderer. |
| Data/domain model | YAML entity-relationship spec with entities and relationships. | Mermaid ER/custom ER renderer. |
| State/lifecycle map | YAML state-machine spec with states, transitions, and gates. | Mermaid state diagram or custom state renderer. |

YAML is canonical for diagram raw data because agents can maintain it safely and the UI can transform it into renderer-specific structures. Mermaid, Cytoscape element JSON, and SVG are renderer targets unless a later task explicitly promotes a renderer-specific file to source truth.

The component inspector should extract the corresponding Markdown document frontmatter and sections. It should show source paths and preserve links to related docs. Selecting an edge, sequence step, entity relationship, or state transition should explain the relationship when the source map exposes it.

The renderer should arrange visual diagrams with readable spacing, route edges around node boxes, draw edges behind nodes, and use the available workspace as a canvas. Arrows should not cover components or labels.

## Board view contract

The Board view reads roadmap work truth and related graph/build/validation/evidence links. It should show active tasks, sprint scope, gates, blockers, acceptance criteria, next actions, and closure evidence without duplicating full requirements prose.

Board is where users inspect the work being done. Detailed builds, validation reports, and feedback decisions should surface through task/evidence links and inspectors rather than their own permanent top-level sections.

## Graph view contract

The Graph view reads `.codewiki/index_graph.json` and renders nodes and edges visually. It should default to useful work-centered slices rather than the entire graph.

It should support filtering by node kind, edge kind, active task or sprint scope, drift, stale state, and build DAG relationships. Large graphs should default to useful scoped or filtered slices instead of rendering all relationships at once. Selecting a node or edge should show source paths, relationship reason, freshness state, and the smallest useful next reads.

The first graph renderer is Cytoscape.js, served from the installed `cytoscape` npm package through the local Control Room server. The browser UI must not depend on a CDN. If the local vendor asset cannot be loaded, the Graph view should show a clear renderer-unavailable error instead of silently rendering an empty canvas.

The graph is generated state, not canonical truth. Every node or edge detail should link back to canonical files when available.

## Contextual detail contract

The UI may expose detailed artifacts contextually:

- Knowledge appears through Product/System cards, inspectors, graph nodes, and source links.
- Builds appear through Board/Graph evidence links and compiler handoff summaries.
- Validation appears through Board gates, Graph relationships, inspector warnings, and source links.
- Diff rows appear only when a pending feedback decision needs explicit action.
- Settings appear through command palette or maintenance actions.

These details should not create hidden UI-only truth or permanent first-level destinations in the simplified Control Room.

## Session and multi-computer model

Local sessions should identify their harness, machine, repository root, branch, commit, active task, claim ids, and last-seen timestamp when this information is available. The UI may display these values, but durable coordination must continue to flow through git, scoped claims, task evidence, builds, and validation reports.

Multiple computers using separate clones synchronize durable truth through git. Runtime session history remains local unless it is intentionally summarized into CodeWiki artifacts.

## Boundaries

- Browser UI code and local web-server code must not import Pi SDK or Pi TUI packages.
- Browser UI vendor assets must be served locally from package dependencies or bundled package files, not from hosted CDNs.
- Pi launch commands belong in the Pi adapter.
- CLI and MCP launch surfaces should live in their own adapters when implemented.
- Domain and application layers must remain browser/UI agnostic.
- The UI must not hand-edit generated graph state.
- The UI must not make builds, validation, diff rows, or settings hidden canonical state.
- The package must not become a hosted service or general long-running orchestration platform.

## Success signals

- A user can launch a local browser Control Room from the current repo, with automatic browser opening when available and a plain local URL fallback when not.
- The Control Room renders a retro terminal-style shell without depending on Pi TUI rendering.
- Top-level navigation is limited to Status, Product, System, Board, and Graph.
- Status is compact and metrics-oriented.
- Product is curated from product Markdown into source-backed cards and relationships.
- System renders selectable diagrams from `.codewiki/kb/system/diagrams/**` and source-backed component docs.
- Board maps roadmap work, gates, blockers, and closure evidence.
- Graph shows work-centered generated relationships with filters, zoom, source links, and freshness cues.
- Deprecated detail areas remain reachable contextually without creating UI noise.
- Pi remains able to provide a compact status panel, but the rich visual experience is not Pi-specific.
- Future harnesses can reuse the same UI and API surface without changing CodeWiki semantics.

## Related docs

- [Control Room UI Product Spec](../product/uis/control-room.md)
- [Status Panel UI](../product/uis/status-panel.md)
- [Graph Navigation UI](../product/uis/graph-navigation.md)
- [System diagram raw data](diagrams/README.md)
- [API](api.md)
- [Adapters](adapters.md)
- [Extension](extension.md)
- [Graph](graph.md)
