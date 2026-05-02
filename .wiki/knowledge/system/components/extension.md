---
id: system.components.extension
title: CodeWiki Extension
state: active
summary: Pi package extension surface that exposes commands, status panel, skills, and agent tools.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - extensions/codewiki/index.ts
---

# CodeWiki Extension

## Responsibilities

Pi package extension surface that exposes commands, status panel, skills, and agent tools.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
