---
id: system.flows.runtime-transaction
title: Runtime Transaction Flow
state: active
summary: Runtime operations use CodeWiki semantic transaction boundaries instead of mutating generated state directly.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
---

# Runtime Transaction Flow

## Flow

Runtime operations use CodeWiki semantic transaction boundaries instead of mutating generated state directly.

## Rules

- Keep canonical truth and generated graph/index state separated.
- Expand exact canonical docs only when views are insufficient for the task.

## Related docs

- [System Overview](../overview.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
