---
id: spec.system.overview
title: System Overview
state: active
summary: Main runtime areas and ownership boundaries for CodeWiki.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - extensions/codewiki
  - skills
---

# System Overview

## Main boundaries

CodeWiki maintains the repository-local `.codewiki/` contract and exposes it through Pi-native workflows.

- **Knowledge base semantics** own product specs, product UI specs, system client specs, system specs, architecture rules, and workflow vocabulary under `.codewiki/kb/**`.
- **Roadmap semantics** own tracked implementation delta and task packs under `.codewiki/roadmap/**`.
- **Compiler builds** own compact handoff artifacts under `.codewiki/builds/**`.
- **Validation gateways** own handoff judgments and failed, blocked, or policy-kept reports under `.codewiki/validation/**`.
- **Graph/index generation** owns the generated `.codewiki/index_graph.json` read model and any small cached graph lenses.
- **Pi package and extension surface** owns commands, tools, status panel, session integration, packaged skills, bootstrap templates, smoke coverage, and resource discovery.
- **Runtime gateway boundary** owns CodeWiki-specific transactions, validation orchestration, and capability descriptors, while sandboxed execution belongs to Pi or optional runtime packages.
- **System clients** own technical distribution and adapter contracts such as the Pi extension, packaged skills, future CLI/TUI/MCP clients, and optional runtime programs.

## Canonical and generated boundary

Canonical truth that agents and semantic tools may mutate through approved flows:

- `.codewiki/config.json` for repo-local contract and runtime policy.
- `.codewiki/kb/**/*.md` and `.codewiki/kb/**/*.json` for current intended knowledge.
- `.codewiki/roadmap/**` for task packs and roadmap state.
- `.codewiki/builds/**` for compiler outputs.
- `.codewiki/validation/**` for failed, blocked, or policy-kept validation reports.

Generated read model:

- `.codewiki/index_graph.json` as the primary graph-first index.
- optional small status or queue lenses derived from the graph for UI performance.

Agents should not hand-edit generated graph/index files. Durable changes flow into knowledge, roadmap, builds, or validation reports first; generated read models are rebuilt afterward.


## Compiler model

CodeWiki v2 uses three compilers (each with its own spec file) and a validation gateway:

- [Feedback Compiler](compilers/feedback.md) — grounds user intent.
- [Documentation Compiler](compilers/documentation.md) — updates knowledge and creates task packs.
- [Implementation Compiler](compilers/implementation.md) — executes task packs.
- [Validation Gateway](compilers/validation-gateway.md) — read-only alignment check at each handoff.

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build + task packs
    -> implementation compiler -> implementation_build
```

The feedback compiler maps user intent and blind spots. The documentation compiler updates knowledge and roadmap/task packs. The implementation compiler creates tests/code and execution evidence.

Each compiler handoff is guarded by a validation gateway. Gateways check both vertical alignment across layers and horizontal alignment inside each layer.

## Ownership seams

- [Extensions / CodeWiki](extensions/codewiki/overview.md) owns the packaged extension and Pi adapter surface under `extensions/codewiki`.
- [CodeWiki Extension](components/extension.md) describes the thin entrypoint and `src/adapters/pi/**` adapter boundary.
- [View Rebuild](components/view-rebuild.md) currently owns the rebuild runner seam and must migrate toward graph/index generation.
- [Generated Graph View](components/views.md) owns the target generated read model contract.
- [Roadmap Tasks](components/roadmap.md) owns roadmap and task-pack semantics.
- [Runtime Policy](runtime/overview.md) owns transactions, validation orchestration, and runtime capability boundaries.
- [Pi Extension Client](clients/pi-extension.md) owns the primary technical distribution through Pi.
- [Future Technical Clients](clients/future-adapters.md) owns future adapter and distribution boundaries.
- [CodeWiki v2 Operating Model](v2-operating-model.md) owns the current compiler, validation, graph, memory, and sanitation target.

CodeWiki should not implement a general sandbox or duplicate Pi observability/eval packages. It defines `.codewiki/` semantics and lets Pi-native runtimes execute bounded work safely.

## Current package architecture

The package is in a DDD-style migration with enforced import guardrails:

- `extensions/codewiki/index.ts` is a thin stable entrypoint.
- `extensions/codewiki/src/adapters/pi/**` contains Pi-specific lifecycle hooks, commands, tools, shortcuts, status dock/panel, and TUI rendering.
- `extensions/codewiki/src/core/**` contains transitional CodeWiki semantics and must remain free of Pi SDK/TUI imports and adapter back-imports.
- `extensions/codewiki/src/infrastructure/**` contains concrete filesystem and rebuild execution implementations.
- `extensions/codewiki/src/engine/**` contains the canonical TypeScript rebuild engine.
- `extensions/codewiki/src/domain/**` contains pure shared domain types and helpers.

`scripts/check-architecture.mjs` enforces the current boundaries during `npm test`.

## Architecture organization rule

System docs should mirror meaningful project hierarchy and abstraction layers.

- component docs explain architecture nodes.
- flow docs explain important cross-component information paths.
- compiler docs explain layer handoffs and build artifacts.
- generated graph views render relationships for status, routing, validation, and UI.
- `overview.md` files are navigation and summaries only, not large truth dumps.

## Architecture review loop

Architecture review is a planning input, not an automatic refactor pass. Reviews should look for real friction in module depth, seams, adapters, locality, leverage, testability, and code/spec ownership. Findings become one of three things:

- a clarification to owning `.codewiki/kb/**` specs,
- a roadmap task with acceptance criteria and validation expectations,
- an explicit non-goal or deferred decision.

When review exposes ambiguity or unmapped user intent, the work escalates back to the feedback compiler.

## Related docs

- [Product](../product/overview.md)
- [Lexicon](../lexicon.md)
- [Status Panel UI](../product/uis/status-panel.md)
- [Pi Extension Client](clients/pi-extension.md)
