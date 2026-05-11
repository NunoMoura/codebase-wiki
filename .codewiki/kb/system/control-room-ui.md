---
id: spec.system.control-room-ui
title: Control Room UI
state: active
summary: Standalone local web UI and hosting surface for the CodeWiki control room.
owners:
  - architecture
  - engineering
updated: "2026-05-11"
code_paths:
  - extensions/codewiki/src/adapters/web
  - extensions/codewiki/src/adapters/pi/commands
  - extensions/codewiki/src/application
  - extensions/codewiki/src/infrastructure
---

# Control Room UI

## Responsibility

The Control Room UI is the standalone local web surface for CodeWiki. It serves a browser-based command center for the current repository, renders product and system views, visualizes generated graph relationships, and delegates semantic reads and writes to the CodeWiki API.

The Control Room is a product UI and an access surface. It must not own CodeWiki truth. Product intent remains in `.codewiki/kb/**`, work truth remains in roadmap state, compiler handoffs remain in builds, validation truth remains in validation reports, coordination state remains in runtime claims, and generated relationships remain in `.codewiki/index_graph.json`.

## Local hosting model

The default hosting model is local-first:

```text
codewiki ui or harness launcher
  -> local HTTP server on 127.0.0.1:<port>
    -> browser Control Room
      -> CodeWiki API/application capabilities
        -> repo-local .codewiki files, graph state, code paths, and git metadata
```

The server should bind to `127.0.0.1` by default, choose an available port, and open or print a local URL. It should not require hosted infrastructure, accounts, or internet access.

Optional shared LAN/server mode may be added later with an explicit flag, token authentication, and clear warnings. It must never be the default.

## Harness integration

Harnesses launch or connect to the Control Room; they do not fork the UI semantics.

| Harness or access surface | Expected role |
| --- | --- |
| Pi | Provide a command or shortcut that launches the local Control Room and keep the compact TUI status panel as a fallback. |
| CLI | Start the local server and print or open the URL. |
| MCP | Expose the same API capabilities for non-visual agent access. |
| Claude Code | Launch through CLI or MCP when implemented. |
| Codex | Launch through CLI or MCP when implemented. |
| Editors | Open the local URL or embed it when a real integration exists. |

## API contract

The Control Room should use typed CodeWiki API capabilities or thin HTTP endpoints over those capabilities. Minimum read endpoints for the first version are:

- repository status and health,
- current session/focus summary,
- roadmap summary,
- generated graph state,
- system architecture diagram source,
- system component document summaries,
- pending feedback diff tables,
- active change claims.

Write endpoints should be added only when the view needs a real action. They must route through existing application use cases such as feedback diff-table actions, roadmap task actions, claim actions, build writing, validation writing, and graph rebuilds.

## System view contract

The System view reads `.codewiki/kb/system/architecture.mmd` and maps each selectable component to a matching `.codewiki/kb/system/<component>.md` file. The diagram renderer may use Mermaid-compatible parsing or a custom renderer, but the source of the architecture remains the `.mmd` file.

The renderer should arrange components into readable lanes or groups, route edges around node boxes, draw edges behind nodes, and use the available workspace as a canvas. Arrows should not cover components or labels.

The component inspector should extract the corresponding Markdown document frontmatter and sections. It should show source paths and preserve links to related docs.

## Graph view contract

The Graph view reads `.codewiki/index_graph.json` and renders nodes and edges visually. It should support filtering by node kind, edge kind, active task or sprint scope, drift, stale state, and build DAG relationships.

The renderer should provide zoom in, zoom out, fit, and reset controls. Large graphs should default to useful scoped or filtered slices instead of rendering all relationships at once. The graph canvas should support scrolling or panning so users can inspect details without losing the left navigation rail or right inspector.

The graph is generated state, not canonical truth. Every node or edge detail should link back to canonical files when available.

## Session and multi-computer model

Local sessions should identify their harness, machine, repository root, branch, commit, active task, claim ids, and last-seen timestamp when this information is available. The UI may display these values, but durable coordination must continue to flow through git, scoped claims, task evidence, builds, and validation reports.

Multiple computers using separate clones synchronize durable truth through git. Runtime session history remains local unless it is intentionally summarized into CodeWiki artifacts.

## Boundaries

- Browser UI code and local web-server code must not import Pi SDK or Pi TUI packages.
- Pi launch commands belong in the Pi adapter.
- CLI and MCP launch surfaces should live in their own adapters when implemented.
- Domain and application layers must remain browser/UI agnostic.
- The UI must not hand-edit generated graph state.
- The package must not become a hosted service or general long-running orchestration platform.

## Success signals

- A user can launch a local browser Control Room from the current repo.
- The Control Room renders a retro terminal-style shell without depending on Pi TUI rendering.
- The visual theme uses muted green as a base, white/off-white as primary highlight, amber/old-gold as secondary accent, and avoids blue highlight dependency.
- Product, System, Graph, Roadmap, Builds, Validation, Diff, and Settings have recognizable source-backed representations.
- System architecture is visual, readable, edge-routed, and component selections are backed by matching system Markdown files.
- The generated graph is visible, zoomable, filterable, and source-backed.
- Pi remains able to provide a compact status panel, but the rich visual experience is not Pi-specific.
- Future harnesses can reuse the same UI and API surface without changing CodeWiki semantics.

## Related docs

- [Control Room UI Product Spec](../product/uis/control-room.md)
- [Status Panel UI](../product/uis/status-panel.md)
- [Graph Navigation UI](../product/uis/graph-navigation.md)
- [API](api.md)
- [Adapters](adapters.md)
- [Extension](extension.md)
- [Graph](graph.md)
