---
id: spec.system.roadmap
title: Roadmap
state: active
summary: Work truth for active items, priority, status, blockers, progress, and closure.
owners:
  - architecture
updated: "2026-05-11"
code_paths:
  - .codewiki/roadmap.json
  - .codewiki/roadmap
---

# Roadmap

## Responsibility

The roadmap owns active work truth. It records work that is todo, in progress, blocked, under verification, or briefly retained after closure for handoff.

The roadmap can group related tasks into sprints. A sprint is a bounded cohort of tasks with a shared outcome, scope, budget, and closure checkpoint. Sprints help users and agency runs work at roadmap, sprint, or task granularity without turning CodeWiki into a full project-management suite.

The roadmap is not the long-term archive. Git preserves full historical task state. Builds and validation reports preserve semantic handoff/evidence when needed. Closed or cancelled tasks should leave the hot roadmap after a short retention window or release checkpoint.

The roadmap is not the requirements brief. Requirements live in accepted builds and durable knowledge. Roadmap items reference those sources and track execution state.

Gated agency uses roadmap state as work truth. The graph derives scoped views, queue order, and next-action routing, while the agency controller owns budgets, stop conditions, and autonomous step orchestration.

## Sprint contents

A sprint should record:

- id,
- title,
- outcome,
- status such as `planned`, `active`, `review`, or `closed`,
- task ids,
- scope across knowledge, roadmap, builds, validation, code, or tests,
- budget limits such as time, token, cost, write, session, and risk limits,
- closure gates such as validation, checkpoint, and garbage collection.

Future sprints can stay outcome-level. The active sprint should be decomposed into executable roadmap tasks. The canonical roadmap JSON supports a top-level `sprints` map; generated graph and roadmap state expose sprint ids, active sprint ids, task membership, scope, budget, and gates.

## Roadmap item contents

A roadmap work item should record:

- id,
- title,
- priority,
- status,
- owner or agent role when needed for durable work tracking,
- linked knowledge paths,
- linked build paths,
- linked code/test paths when known,
- concise outcome,
- acceptance summary,
- blockers,
- progress/evidence refs,
- closure reason.

It should not duplicate full feedback, documentation, or implementation briefs.

Roadmap ownership is durable work ownership. Parallel execution ownership belongs to scoped change claims: a session can temporarily claim affected knowledge paths, roadmap task state, build refs, validation refs, or code paths while the roadmap item continues to describe why the work exists and how it closes.

## Status semantics

Roadmap status should answer the work-state question, not the truth-state question.

Typical active statuses:

- `todo`,
- `in_progress`,
- `blocked`,
- `verify`.

Closure statuses may exist only as short-lived retained state:

- `done`,
- `cancelled`.

The graph state machine owns reconciliation state such as drift, freshness, routing, and next loop.

## Gated agency support

For automated roadmap progress, roadmap state should expose canonical sprint/task fields needed to derive:

- eligible work items by roadmap, sprint, or task scope,
- blocked and approval-required items,
- linked builds and knowledge paths,
- required validation gates,
- configured time, token, cost, write, session, and risk budgets,
- known risk level,
- evidence needed before closure.

The roadmap should not decide whether an agent may continue or what queue order to present. It supplies work truth to the graph state machine and agency controller.

## Retention and history

Hot roadmap state should contain active sprints, active work, active claims, unconsumed builds, fail/block validation, and any recently closed/cancelled work still needed for immediate handoff. Warm state contains recent pass evidence and accepted handoffs. Cold state contains consumed/validated history. Purgeable state contains expired runtime artifacts. After sprint checkpoint or retention expiry, closed/cancelled task detail should move out of the active roadmap and rely on:

- git for full history,
- implementation builds for implementation evidence,
- validation reports for fail/block/policy-kept decisions,
- release checkpoints for compact closed-work summaries.

This keeps the roadmap useful as active work truth instead of an archive.

## Closure

Work should close only when:

- linked intent/spec/evidence is traceable,
- required checks ran or were explicitly deferred by policy,
- validation passed or closure policy explains why validation is not required,
- an implementation build or equivalent evidence brief exists for implemented changes.

## Migration warning

Current task folders under `.codewiki/roadmap/tasks/**` may contain stale generated shards. They are not target requirements briefs. The refactor should decide whether to regenerate or remove them after the new knowledge and graph model are stable.

## Related docs

- [Builds](builds.md)
- [Graph](graph.md)
- [Agency Controller](agency.md)
