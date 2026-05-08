---
id: spec.system.clients.runtime-programs
title: Optional Runtime Programs
state: active
summary: Technical boundary for optional runtime programs and bounded context tools that interoperate with CodeWiki.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - extensions/codewiki/src/engine/gateway.ts
  - scripts/codewiki-gateway.mjs
---

# Optional Runtime Programs

Optional runtime programs can provide ad hoc context creation, filtering, graph validation, temporary analysis, or staged edits. They should use CodeWiki graph state and typed capabilities rather than editing `.codewiki/` internals directly.

ThinkCode is one compatible runtime, not a CodeWiki requirement. Native Pi tools remain the fallback.

## Rules

- Runtime programs may read project files when policy permits.
- CodeWiki-managed writes should flow through task, session, transaction, build, validation, or rebuild capabilities.
- Runtime programs should return compact context packets instead of pushing large raw output into the parent agent session.
- Runtime programs do not own CodeWiki semantics.

## Related docs

- [Runtime Policy](../runtime/overview.md)
- [Context Memory Flow](../flows/context-memory.md)
- [Future Technical Clients](future-adapters.md)
