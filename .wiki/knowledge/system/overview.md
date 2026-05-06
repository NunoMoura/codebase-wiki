---
id: spec.system.overview
title: System Overview
state: active
summary: Main runtime areas and ownership boundaries for CodeWiki.
owners:
  - architecture
updated: "2026-05-05"
code_paths:
  - extensions/codewiki
  - scripts/rebuild_docs_meta.py
  - skills
---

# System Overview

## Main boundaries

CodeWiki has one core responsibility: maintain the repository-local `.wiki` contract and expose it through Pi-native workflows.

- **Knowledge and roadmap semantics** own product specs, system specs, client surfaces, tasks, evidence, views, and rebuild rules.
- **Pi package and extension surface** owns commands, status panels, session integration, packaged skills, bootstrap templates, smoke coverage, and resource discovery.
- **Runtime gateway boundary** owns CodeWiki-specific transactions, verifier orchestration, and capability descriptors, while any sandboxed execution belongs to Pi or optional runtime packages.

## Canonical/view boundary

CodeWiki separates durable intent from generated read models so normal agent work stays token-efficient and drift-resistant.

Canonical truth that agents and semantic tools may mutate:

- `.wiki/config.json` for repo-local contract and runtime policy.
- `.wiki/knowledge/**/*.md` for product, client, and system intent.
- roadmap task records for planned delta.
- event and evidence records for append-only proof and mutation history.

Generated views that are tool-owned read models:

- status and graph views.
- roadmap queue and task context views.
- drift and recent evidence views.
- product brief views.
- system architecture views, including Mermaid render output.

Agents should not hand-edit views. Mutation tools should keep canonical writes separate from view rebuilds. Session updates write canonical state without rebuilding views; task updates can use `refresh=false` for the same minimal-write path when current views are not needed immediately. `codewiki_state refresh=true` or the rebuild capability refreshes views on demand.

## V2 operating model

CodeWiki v2 keeps this contract:

```text
canonical = knowledge + roadmap tasks + evidence
views = optimized read models for agent/UI
agent writes canonical, consumes views
```

The context window is volatile RAM. The `.wiki` is persistent memory. Views are materialized navigation packets that help agents choose the next targeted read without loading the full wiki into session context.

See [CodeWiki v2 Operating Model](v2-operating-model.md) for the target structure, memory policy, subagent roles, heartbeat loop, optional runtime role, and sanitation/versioning policy.

## Ownership seams

- [Extensions / CodeWiki](extensions/codewiki/overview.md) owns the packaged extension and Pi adapter surface under `extensions/codewiki`.
- [CodeWiki Extension](components/extension.md) describes the thin entrypoint and `src/adapters/pi/**` adapter boundary.
- [View Rebuild](components/view-rebuild.md) owns the rebuild runner seam, TypeScript engine path, and generated view invariants.
- [Runtime Policy](runtime/overview.md) owns the transaction boundary for compact reads and validated `.wiki` writes.
- [CodeWiki v2 Operating Model](v2-operating-model.md) owns the current migration target for views, architecture graph, memory policy, and sanitation.

CodeWiki should not implement a general sandbox or duplicate Pi observability/eval packages. It should define what operations are meaningful for `.wiki` and let Pi-native runtimes execute them safely.

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

System docs mirror meaningful project hierarchy, not arbitrary doc categories.

- component docs explain architecture nodes.
- flow docs explain important cross-component information paths.
- generated architecture views render the component/flow graph for the status panel.
- `overview.md` files are navigation and summaries only, not large truth dumps.

## Architecture review loop

Architecture review is a planning input, not an automatic refactor pass. Reviews should look for real friction in module depth, seams, adapters, locality, leverage, testability, and code/spec ownership. Findings become one of three things:

- a clarification to owning `.wiki/knowledge` specs,
- a roadmap task with acceptance criteria and verification,
- an explicit non-goal or deferred decision.

The review should present friction candidates before proposing final interfaces so humans can pick which design branch matters.

## Related docs

- [Product](../product/overview.md)
- [Lexicon](../lexicon.md)
- [Clients Overview](../clients/overview.md)
