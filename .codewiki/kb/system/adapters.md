---
id: spec.system.adapters
title: Adapters
state: active
summary: Harness and access-surface translation boundary for Pi, the local Control Room, CLI, MCP, Claude Code, Codex, or other integrations.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - extensions/codewiki/src/adapters
  - skills
---

# Adapters

## Responsibility

Adapters translate external harness capabilities, local UI transports, and protocol surfaces into the CodeWiki API and translate CodeWiki results back into commands, tools, visual UI, messages, protocols, or sessions.

Adapters do not own CodeWiki semantics. Domain and application layers own semantics; infrastructure owns concrete side effects.

## Access surfaces and UIs

Tools, commands, skills, CLI, MCP, package APIs, local web transports, and harness integrations are adapter or API access surfaces. They are not product UIs unless they render a visual screen, panel, board, graph view, or editor interface for a human.

Visual UI expectations live under product `uis/**`; adapter, launch, transport, and protocol mechanics live here, in [CodeWiki API](api.md), and in [Control Room UI](control-room-ui.md).

## Current adapter

Pi is the only implemented harness adapter now. It packages:

- commands,
- tools,
- compact visual status UI,
- skills,
- session integration,
- scoped change claims for parallel work,
- bootstrap and setup actions.

## Future adapters

Future harnesses may not support Pi packages or extensions. They should use the same API through CLI, MCP, or a package-level programmatic interface.

Potential future access paths:

| Harness or access surface | Likely adapter |
| --- | --- |
| Claude Code | CLI or MCP. |
| Codex | CLI or MCP. |
| Other local agents | CLI, MCP, or package API. |
| Editor integrations | CLI, MCP, local Control Room URL, or language-specific wrapper. |
| Humans | Local Control Room, CLI/status output, and compact host panels. |

Do not create empty adapter implementations before they are needed. Keep the structure ready, but implement only real access surfaces.

## Skills

Packaged CodeWiki skills are adapter-facing workflow guidance for agents. They should remain progressive-disclosure prompts that route work into the same API and loop model.

Global third-party skills should not mutate CodeWiki state unless adapted to the CodeWiki contract. General engineering skills are acceptable when they do not override CodeWiki knowledge, roadmap, build, validation, claim, or graph semantics.

## Rules

- Harness-specific dependencies stay in adapters.
- Adapters call application use cases or API capabilities.
- Adapters never hand-edit generated graph state.
- Adapters should support bounded context and compact outputs.
- Adapter differences must not create different truth semantics.
- Local web UI code must not import Pi SDK or Pi TUI packages.
- Adapter-exposed agency controls must route through the API and agency controller rather than running unbounded loops directly.

## Related docs

- [API](api.md)
- [Control Room UI](control-room-ui.md)
- [Extension](extension.md)
- [Agency Controller](agency.md)
