---
id: system.components.runtime-gateway
title: Runtime Gateway
state: active
summary: CodeWiki-specific transaction and gateway scripts for validated non-interactive operations.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - scripts/codewiki-gateway.mjs
---

# Runtime Gateway

## Responsibilities

CodeWiki-specific transaction and gateway scripts for validated non-interactive operations.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
