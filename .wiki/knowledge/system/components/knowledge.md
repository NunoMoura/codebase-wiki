---
id: system.components.knowledge
title: Canonical Knowledge
state: active
summary: Durable product, system, flow, and lexicon truth maintained by agents.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - .wiki/knowledge
---

# Canonical Knowledge

## Responsibilities

Durable product, system, flow, and lexicon truth maintained by agents.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
