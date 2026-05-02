---
id: spec.product.surfaces
title: Product Surfaces
state: active
summary: Human and AI interaction surfaces for CodeWiki.
owners:
  - product
  - clients
updated: "2026-05-01"
---

# Product Surfaces

## Pi tools

Internal `codewiki_*` tools are the primary AI-facing surface. Agents should use `codewiki_state` for compact reads, `codewiki_task` for roadmap truth, and `codewiki_session` for runtime focus notes.

## Pi commands and status panel

Human-facing commands and the status panel expose current state, product intent, system architecture, and work board focus. The status panel header shows only the repo name. Its tabs are Home, Product, System, and Board: Home shows the overall traffic-light status and influencing factors; Product shows users, stories, and surfaces; System renders the architecture Mermaid diagram with selectable components; Board keeps backend roadmap data but labels it in user-facing UI as a board.

## Skills

Skills encode workflow policy for planning, task execution, research, verification, and architecture review. They should tell agents when to consume views, when to expand canonical docs, and when to spawn subagents.

## Generated views

Views are the main navigation surface for agents and UI. They should be small, revisioned, and purpose-specific: status, roadmap queue, task context, product brief, system architecture, drift, and recent evidence.

## Optional runtime programs

Optional runtime programs can provide ad hoc context creation, filtering, graph validation, and temporary analysis. They should use CodeWiki views and capabilities rather than editing `.wiki` internals directly.

## Future adapters

Future surfaces may include CLI, TUI, MCP, editor integrations, package APIs, and service agents. All adapters should preserve the canonical/view boundary and use typed CodeWiki capabilities for semantic writes.

## Related docs

- [Product](overview.md)
- [Users](users.md)
- [Stories](stories.md)
- [Clients Overview](../clients/overview.md)
