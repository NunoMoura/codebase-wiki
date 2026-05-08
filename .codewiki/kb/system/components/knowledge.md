---
id: system.components.knowledge
title: Canonical Knowledge
state: active
summary: Durable product, system, flow, and lexicon truth maintained by agents.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - .codewiki/kb
---

# Canonical Knowledge

## Responsibilities

Durable product, system, flow, and lexicon truth maintained by agents.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before graph/index state is rebuilt.
- Generated graph/index state are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
