---
id: spec.system.adapters
title: Adapters
state: active
summary: Harness translation boundary for Pi today and CLI, MCP, Claude Code, Codex, or other access surfaces later.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - extensions/codewiki/src/adapters
  - skills
---

# Adapters

## Responsibility

Adapters translate external harness capabilities into the CodeWiki API and translate CodeWiki results back into harness-specific commands, tools, visual UI, messages, protocols, or sessions.

Adapters do not own CodeWiki semantics. Domain and application layers own semantics; infrastructure owns concrete side effects.

## Access surfaces and UIs

Tools, commands, skills, CLI, MCP, package APIs, and harness integrations are adapter or API access surfaces. They are not product UIs unless they render a visual screen, panel, board, graph view, or editor interface for a human.

Visual UI expectations live under product `uis/**`; adapter and protocol mechanics live here and in [CodeWiki API](api.md).

## Current adapter

Pi is the only implemented adapter now. It packages:

- commands,
- tools,
- visual status UI,
- skills,
- session integration,
- bootstrap and setup actions.

## Future adapters

Future harnesses may not support Pi packages or extensions. They should use the same API through CLI, MCP, or a package-level programmatic interface.

Potential future access paths:

| Harness or access surface | Likely adapter |
| --- | --- |
| Claude Code | CLI or MCP. |
| Codex | CLI or MCP. |
| Other local agents | CLI, MCP, or package API. |
| Editor integrations | CLI, MCP, or language-specific wrapper. |
| Humans | CLI/status output and future visual UI. |

Do not create empty adapter implementations before they are needed. Keep the structure ready, but implement only real access surfaces.

## Skills

Packaged CodeWiki skills are adapter-facing workflow guidance for agents. They should remain progressive-disclosure prompts that route work into the same API and loop model.

Global third-party skills should not mutate CodeWiki state unless adapted to the CodeWiki contract. General engineering skills are acceptable when they do not override CodeWiki knowledge, roadmap, build, validation, or graph semantics.

## Rules

- Harness-specific dependencies stay in adapters.
- Adapters call application use cases or API capabilities.
- Adapters never hand-edit generated graph state.
- Adapters should support bounded context and compact outputs.
- Adapter differences must not create different truth semantics.
- Adapter-exposed agency controls must route through the API and agency controller rather than running unbounded loops directly.

## Related docs

- [API](api.md)
- [Extension](extension.md)
- [Agency Controller](agency.md)
