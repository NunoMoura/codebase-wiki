---
id: spec.system.clients.pi-extension
title: Pi Extension Client
state: active
summary: Technical distribution and adapter contract for the Pi-hosted CodeWiki extension.
owners:
  - architecture
  - engineering
updated: "2026-05-07"
code_paths:
  - extensions/codewiki
  - scripts/smoke-test.mjs
---

# Pi Extension Client

The Pi extension is the primary technical client for CodeWiki today. It packages commands, tools, status UI, bootstrap templates, skills, and rebuild integration for the Pi host runtime.

## Technical responsibilities

- Register `/wiki-*` commands.
- Register `codewiki_*` agent tools.
- Register `Alt+W` status panel UI.
- Ship workflow skills under `skills/**`.
- Bootstrap and adopt `.codewiki/` in repositories.
- Preserve semantic writes through CodeWiki task, session, transaction, build, validation, and rebuild capabilities.
- Keep Pi SDK and TUI dependencies inside the adapter layer.

## Boundaries

The Pi extension is not the canonical knowledge source. Product UI expectations live under `product/uis/**`; core semantics live under system components, flows, runtime policy, roadmap tasks, compiler builds, and validation reports.

## Related docs

- [CodeWiki Extension](../components/extension.md)
- [Extensions / CodeWiki](../extensions/codewiki/overview.md)
- [Agent Tools UI](../../product/uis/agent-tools.md)
- [Status Panel UI](../../product/uis/status-panel.md)
