---
id: spec.system.clients.future-adapters
title: Future Technical Clients
state: active
summary: Technical distribution boundary for future CLI, TUI, MCP, editor, package API, and service-agent clients.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - extensions/codewiki/src/application
---

# Future Technical Clients

Future technical clients may include CLI, TUI, MCP, editor integrations, package APIs, service agents, and optional runtime programs.

## Technical contract

All clients should preserve the same `.codewiki/` semantics:

- read graph-backed state through stable capabilities,
- perform semantic writes through CodeWiki APIs or validated transactions,
- never hand-edit generated graph/index state,
- keep compiler builds and validation reports schema-checked,
- treat passing validation as transient unless policy requires storage,
- store failed or blocked validation reports under `.codewiki/validation/**`.

## Distribution rule

Product UI expectations belong under `product/uis/**`. This system client area describes adapter shape, runtime boundaries, packaging, protocol choices, and capability contracts.

## Related docs

- [Future Adapter UIs](../../product/uis/future-adapters.md)
- [Runtime Policy](../runtime/overview.md)
- [V2 Operating Model](../v2-operating-model.md)
