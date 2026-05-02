---
id: system.components.view-rebuild
title: View Rebuild
state: active
summary: Generator that derives graph, lint, roadmap, status, and v2 views from canonical truth.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - scripts/rebuild_docs_meta.py
---

# View Rebuild

## Responsibilities

Generator that derives graph, lint, roadmap, status, and v2 views from canonical truth.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.

## Related docs

- [System Overview](../overview.md)
- [Architecture Manifest](../architecture.json)
