---
id: spec.product.uis.control-room
title: Control Room UI
state: active
summary: Product expectations for the standalone local CodeWiki control room experience.
owners:
  - product
  - design
updated: "2026-05-11"
code_paths:
  - extensions/codewiki/src/adapters/web
  - extensions/codewiki/src/adapters/pi/commands
---

# Control Room UI

The Control Room is the primary visual product surface for CodeWiki. It represents the repository-local CodeWiki contract as a navigable workspace rather than as a compact status panel. It should help humans and agents understand intent, architecture, graph relationships, roadmap work, compiler handoffs, validation gates, and coordination state from one coherent interface.

The Control Room is local-first. By default it runs against the current repository on `127.0.0.1` and reads or mutates CodeWiki through the same API semantics used by harness adapters. It must not require hosted infrastructure, accounts, or internet access.

The Pi TUI remains a compact launcher and fallback surface. Future Claude Code, Codex, CLI, MCP, or editor integrations should be able to launch or connect to the same Control Room without changing CodeWiki truth semantics.

## Layout model

The Control Room should use a three-pane command-center layout:

```text
header: repo, health, active task, active claims, command palette
left rail: Home, System, Graph, Knowledge, Board, Builds, Validation, Diff, Settings
workspace: visual map for the selected section
inspector: selected entity detail, source path, links, actions, and warnings
bottom rail: recent events, stale-state warnings, and next safe action
```

The center workspace should prioritize visual navigation. The inspector should ground every selection in canonical sources, such as `.codewiki/kb/**`, `.codewiki/roadmap/**`, `.codewiki/builds/**`, `.codewiki/validation/**`, `.codewiki/runtime/claims.json`, `.codewiki/runtime/diff-tables.json`, and `.codewiki/index_graph.json`.

## Home view

Home is a mission briefing, not a raw status dump. It should show:

- repository health,
- current focus or active task,
- next safe action,
- active claims and conflicts,
- open gates or blockers,
- latest feedback, documentation, implementation, and validation signals,
- compact previews of the system diagram and generated graph,
- a source-backed representation of major CodeWiki areas: Product, System, Graph, Roadmap, Builds, Validation, Diff, and Settings.

## System view

System should render `.codewiki/kb/system/architecture.mmd` as a visual architecture diagram. Components are selectable. Selecting a component shows an inspector populated from the matching `.codewiki/kb/system/<component>.md` file.

The system diagram should use readable lane or group placement, enough spacing, routed edges, and edge drawing behind nodes so arrows do not sit on top of components. The view should use the available workspace as a canvas rather than nesting the diagram inside unnecessary inner panels.

The inspector should show the component title, summary, responsibility, rules or invariants, code paths, related docs, and any graph-backed drift warnings. Selecting an edge should explain the relationship between components when the source map exposes it.

## Graph view

Graph should provide a visual representation of `.codewiki/index_graph.json`. It should show nodes and edges for knowledge docs, roadmap work, builds, validation reports, code paths, tests, claims, diff tables, and reconciliation items.

Users should be able to filter by node kind, edge kind, active task, active sprint, stale items, drift items, and build DAG edges. The graph should provide zoom in, zoom out, fit, and reset controls. The default view should avoid showing every node and edge at once when that would be unreadable; it should start from a useful scoped or filtered slice and let users expand from there. Selecting a node or edge should show source paths, relationship reason, freshness state, and the smallest useful next reads.

The graph view is an inspection and navigation surface. Canonical edits still flow through CodeWiki API operations and compiler loops.

## Knowledge, Board, Builds, Validation, and Diff views

Knowledge should browse product and system specs without hiding source paths. Board should show roadmap work, active sprint or task scope, gated agency limits, and closure evidence. Builds should show compiler handoff timelines and consumes/produces edges. Validation should show gates, failures, blocks, and policy-kept reports. Diff should show pending feedback decisions and accepted rows when no pending decisions exist.

## Style

The Control Room should keep the retro terminal feeling associated with Pi while using browser-native rendering:

- dark background,
- monospace typography,
- muted monochrome green as the base terminal tone,
- white or off-white as the primary highlight color,
- amber or old-gold as the secondary accent for focus, warnings, and important affordances,
- red only for errors or destructive states,
- no cyan or blue highlight dependency,
- visible terminal-style borders,
- keyboard-first navigation,
- command palette,
- optional subtle glow or scanline effects,
- accessible contrast and reduced-motion support.

The style should feel like a terminal command center, not a modern SaaS dashboard. Visual nostalgia must not reduce legibility, keyboard accessibility, or the ability to use the center workspace as the primary canvas.

## Multi-computer behavior

The default multi-computer model is git-synchronized local state. Each computer runs its own local Control Room against its own repo clone. Durable truth synchronizes through git commits and pulls. Runtime state such as active sessions remains local unless it is summarized into claims, task evidence, builds, validation reports, or commits.

Optional shared server mode may be added later. It must be explicit, token-protected, and disabled by default.

## Success signals

- Users can understand CodeWiki as a product, not only as a status panel.
- The UI works locally without hosted infrastructure.
- Pi, Claude Code, Codex, and future harnesses can launch or connect to the same visual experience.
- System architecture is navigable through a rendered diagram and source-backed component inspector.
- Generated graph relationships are visible, filterable, and source-backed.
- Every visible entity points back to canonical truth or generated graph state.
- The retro terminal aesthetic remains readable, keyboard-accessible, and browser-native.

## Non-goals

- No hosted SaaS dependency.
- No real-time multiplayer collaboration in the first version.
- No UI-only source of truth.
- No direct hand-editing of generated graph state.
- No replacement for compiler loops, validation gates, or scoped change claims.

## Related docs

- [Status Panel UI](status-panel.md)
- [Graph Navigation UI](graph-navigation.md)
- [Board UI](board.md)
- [Control Room UI System Component](../../system/control-room-ui.md)
- [CodeWiki API](../../system/api.md)
- [Adapters](../../system/adapters.md)
- [Graph](../../system/graph.md)
