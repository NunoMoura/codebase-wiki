---
id: spec.product.uis.control-room
title: Control Room UI
state: active
summary: Product expectations for the simplified second-screen CodeWiki Control Room.
owners:
  - product
  - design
updated: "2026-05-12"
code_paths:
  - extensions/codewiki/src/adapters/web
  - extensions/codewiki/src/adapters/pi/commands
---

# Control Room UI

The Control Room is the primary visual product surface for CodeWiki, but it is not meant to show every CodeWiki artifact all the time. Users normally operate CodeWiki through an agent chat on the main screen and keep the Control Room on a second screen for orientation, navigation, and high-signal state.

The Control Room should therefore optimize for signal-to-noise ratio. It should help users see current status, product intent, system shape, roadmap work, and graph relationships without turning the UI into a raw file browser, build log viewer, diff console, or replacement for the compiler chat loop.

The Control Room is local-first. By default it runs against the current repository on `127.0.0.1` and reads or mutates CodeWiki through the same API semantics used by harness adapters. It must not require hosted infrastructure, accounts, or internet access.

The Pi TUI remains a compact launcher and fallback surface. Future Claude Code, Codex, CLI, MCP, or editor integrations should be able to launch or connect to the same Control Room without changing CodeWiki truth semantics.

## Layout model

The Control Room should use a simple command-center layout:

```text
header: repo, health, active task, active claims, command palette
left rail: Status, Product, System, Board, Graph
workspace: focused visual map or curated summary for the selected section
inspector: selected entity detail, source path, links, actions, and warnings
bottom rail: recent events, stale-state warnings, and next safe action
```

The top-level navigation should stay small. `Knowledge`, `Builds`, `Validation`, `Diff`, and `Settings` should not be primary sections in the second-screen UI. They remain accessible when they are relevant through the inspector, contextual links, command palette actions, API/chat workflows, and source paths.

The center workspace should prioritize readable visual navigation and curated summaries. The inspector should ground every selection in canonical sources, such as `.codewiki/kb/**`, `.codewiki/roadmap/**`, `.codewiki/builds/**`, `.codewiki/validation/**`, `.codewiki/runtime/claims.json`, `.codewiki/runtime/diff-tables.json`, and `.codewiki/index_graph.json`.

## Status view

`Status` replaces the earlier `Home` concept. Status is a compact project metrics and statistics surface, not a mission briefing or raw state dump.

Status should show only the basics needed to orient the user:

- repository health,
- current branch and commit when available,
- active task or sprint focus,
- next safe action,
- open task count and closed/recent task count,
- active claims and conflicts,
- gate/blocker counts,
- graph node and edge counts,
- stale or drift count,
- latest validation/check signal when available.

Status should avoid long artifact tables, diff rows, build timelines, validation report bodies, and raw JSON. Those details belong in chat, contextual inspectors, or source-backed drill-downs.

## Product view

Product should be the user-facing interpretation layer over `.codewiki/kb/product/**`. Raw Markdown files are the source of truth, but raw Markdown is not enough to provide a good user experience.

The Product view should curate product Markdown into navigable cards and relationships:

- users and their jobs,
- user stories and success signals,
- visual UI surfaces and their purpose,
- links between users, stories, UIs, roadmap work, and implementation evidence,
- source paths for every displayed fact.

The default Product experience should answer who the project serves, what those users need, and which UI surfaces support those outcomes. It should not show raw Markdown as the primary experience. Raw Markdown remains available in the inspector or through chat when the user needs exact source text.

## System view

System should show how the project works through source-backed components and diagrams.

Component knowledge stays in `.codewiki/kb/system/*.md`. Diagram raw data lives under `.codewiki/kb/system/diagrams/**`. The UI should offer a diagram picker, render the selected diagram, and populate the inspector from the selected node, edge, sequence step, entity, or state.

The five core project diagrams are:

| Diagram | Purpose | Canonical raw format | Preferred rendering |
| --- | --- | --- | --- |
| Context map | Show users, access surfaces, external systems, and project boundary. | YAML graph spec with actors, systems, and relationships. | Graph/SVG or Mermaid flowchart. |
| Component/container map | Show major runtime components, adapters, data stores, and dependency direction. | YAML graph spec with groups, nodes, edges, and source docs. | Cytoscape/custom SVG or Mermaid flowchart. |
| Key flow sequence | Show the most important user/agent workflow end to end. | YAML sequence spec with participants and ordered messages. | Mermaid sequence diagram or custom sequence renderer. |
| Data/domain model | Show durable entities, generated state, evidence, and ownership. | YAML entity-relationship spec with entities and relationships. | Mermaid ER/custom ER renderer. |
| State/lifecycle map | Show task, compiler, validation, build, or release lifecycles. | YAML state-machine spec with states, transitions, and gates. | Mermaid state diagram or custom state renderer. |

YAML is the canonical raw format because it is easier for agents to read, edit, diff, and validate than dense diagram DSL. Mermaid, Cytoscape data, or SVG should be treated as renderer targets unless a task explicitly promotes a renderer-specific file to canonical truth.

The System view should preserve readable spacing, routed edges, and edge drawing behind nodes. It should use the available workspace as a canvas rather than nesting diagrams inside unnecessary inner panels.

## Board view

Board should show the work being done in the roadmap. It is the primary view for active tasks, sprint scope, gates, blockers, acceptance criteria, closure evidence, and next actions.

Roadmap work is work truth, not a requirements brief. Full product and system intent should live in knowledge and accepted builds. The Board should link to those sources without duplicating them as long prose.

## Graph view

Graph should provide a visual representation of `.codewiki/index_graph.json`, but it should start from useful work-centered slices rather than the whole graph.

Graph should focus on relationships around active roadmap work, current sprint scope, knowledge/docs touched by the work, builds, validation, evidence, tests, code paths, stale links, drift, and reconciliation cues. Users should be able to expand from that scope when needed.

Users should be able to filter by node kind, edge kind, active task, active sprint, stale items, drift items, and build DAG edges. Selecting a node or edge should show source paths, relationship reason, freshness state, and the smallest useful next reads.

The first graph renderer is Cytoscape.js, served from the installed package rather than a CDN so the Control Room remains local-first.

The graph view is an inspection and navigation surface. Canonical edits still flow through CodeWiki API operations and compiler loops.

## Contextual artifact access

Detailed knowledge docs, builds, validation reports, feedback diff rows, and settings remain important, but they should not compete for top-level navigation by default.

- Knowledge appears through Product/System cards, inspectors, graph nodes, and source links.
- Builds appear through Board/Graph evidence links, compiler handoff summaries, and chat.
- Validation appears through Board gates, Graph relationships, inspector warnings, and chat.
- Diff rows appear in the feedback loop and only surface in the UI when an explicit decision is pending.
- Settings appear through command palette or maintenance actions, not as a primary destination.

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

- Users get a high-signal second screen that complements agent chat instead of duplicating it.
- Top-level navigation is limited to Status, Product, System, Board, and Graph.
- Status shows compact project metrics and statistics without raw artifact dumps.
- Product turns user, story, and UI Markdown into curated source-backed cards and relationships.
- System renders selectable diagrams from `.codewiki/kb/system/diagrams/**` and keeps component inspection source-backed.
- Board maps roadmap work, gates, blockers, acceptance, and closure evidence.
- Graph shows work-centered relationships, freshness, drift, and source paths.
- Deprecated top-level details remain reachable contextually without becoming UI noise.
- The UI works locally without hosted infrastructure.
- Every visible entity points back to canonical truth or generated graph state.
- The retro terminal aesthetic remains readable, keyboard-accessible, and browser-native.

## Non-goals

- No hosted SaaS dependency.
- No real-time multiplayer collaboration in the first version.
- No UI-only source of truth.
- No raw JSON, Markdown, build, validation, or diff wall as the default experience.
- No direct hand-editing of generated graph state.
- No replacement for compiler loops, validation gates, scoped change claims, or agent chat.

## Related docs

- [Status Panel UI](status-panel.md)
- [Graph Navigation UI](graph-navigation.md)
- [Board UI](board.md)
- [Control Room UI System Component](../../system/control-room-ui.md)
- [CodeWiki API](../../system/api.md)
- [Adapters](../../system/adapters.md)
- [Graph](../../system/graph.md)
- [System diagram raw data](../../system/diagrams/README.md)
