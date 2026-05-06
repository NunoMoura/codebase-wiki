---
id: system.components.view-rebuild
title: View Rebuild
state: active
summary: Generator and runner seam that derive graph, lint, roadmap, status, and v2 views from canonical truth.
owners:
  - architecture
updated: "2026-05-05"
code_paths:
  - extensions/codewiki/src/core/rebuild-runner.ts
  - extensions/codewiki/src/infrastructure/rebuild-runner.ts
  - extensions/codewiki/src/engine/rebuild.ts
  - scripts/rebuild_docs_meta.py
---

# View Rebuild

## Responsibilities

View rebuild derives generated read models from canonical truth: knowledge specs, roadmap tasks, evidence, and events.

The current rebuild path is TypeScript-first. `extensions/codewiki/src/engine/rebuild.ts` owns the default engine pipeline. `extensions/codewiki/src/infrastructure/rebuild-runner.ts` owns concrete rebuild execution, including configured command fallback and default engine invocation. `extensions/codewiki/src/core/rebuild-runner.ts` owns the core runner seam and rebuild lock target calculation.

`scripts/rebuild_docs_meta.py` remains packaged for compatibility and configured-command fallback, but it is no longer the only default rebuild path.

## Boundaries

- Core code may ask for a rebuild through a runner port.
- Infrastructure code may execute subprocesses or instantiate the TypeScript engine.
- Engine code derives graph, lint, roadmap, status, and architecture views from canonical files.
- Tools and commands may request rebuilds after canonical mutations, but generated views remain read-only.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.
- Rebuild lock paths must include canonical event/index outputs and generated metadata/status/roadmap view files.
- Configured rebuild commands may fall back between `python` and `python3` aliases when needed.
- Default rebuild should use the packaged TypeScript engine when no explicit command is configured.

## Related docs

- [System Overview](../overview.md)
- [Runtime Gateway](runtime-gateway.md)
- [Architecture Manifest](../architecture.json)
