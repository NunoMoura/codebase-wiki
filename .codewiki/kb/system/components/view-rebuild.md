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
---

# View Rebuild

## Responsibilities

View rebuild derives generated read models from canonical truth: knowledge specs, roadmap tasks, evidence, and events.

The current rebuild path is TypeScript-only. `extensions/codewiki/src/engine/rebuild.ts` owns the default engine pipeline. `extensions/codewiki/src/infrastructure/rebuild-runner.ts` instantiates that engine. `extensions/codewiki/src/core/rebuild-runner.ts` owns the core runner seam and rebuild lock target calculation.

Legacy external rebuild paths are removed from the runtime baseline. The packaged TypeScript engine is the only supported rebuild path.

## Boundaries

- Core code may ask for a rebuild through a runner port.
- Infrastructure code may execute subprocesses or instantiate the TypeScript engine.
- Engine code derives graph, lint, roadmap, status, and architecture views from canonical files.
- Tools and commands may request rebuilds after canonical mutations, but generated graph/index state remain read-only.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before graph/index state is rebuilt.
- Generated graph/index state are read models and must not be hand-edited.
- Rebuild lock paths must include canonical event/index outputs and generated metadata/status/roadmap view files.
- Rebuild uses the packaged TypeScript engine; external rebuild commands are deprecated.

## Related docs

- [System Overview](../overview.md)
- [Runtime Gateway](runtime-gateway.md)
- [Architecture Manifest](../architecture.json)
