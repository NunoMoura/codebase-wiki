---
id: system.components.views
title: Generated Views
state: active
summary: Tool-owned optimized read models consumed by agents and UI.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - .wiki/views
---

# Generated Views

## Responsibilities

Tool-owned optimized read models consumed by agents and UI.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
