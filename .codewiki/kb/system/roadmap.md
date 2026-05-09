---
id: spec.system.roadmap
title: Roadmap
state: active
summary: Work truth for queue, priority, status, blockers, progress, and closure.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - .codewiki/roadmap.json
  - .codewiki/roadmap
---

# Roadmap

## Responsibility

The roadmap owns work truth. It records what work exists, what is active, what is blocked, what is done, and why work can close.

The roadmap is not the requirements brief. Requirements live in accepted builds and durable knowledge. Roadmap items reference those sources and track execution state.

Gated agency uses roadmap state as the work queue, but the agency controller owns budgets, stop conditions, and autonomous step orchestration.

## Roadmap item contents

A roadmap work item should record:

- id,
- title,
- priority,
- status,
- owner or agent role when needed,
- linked knowledge paths,
- linked build paths,
- linked code/test paths when known,
- concise outcome,
- acceptance summary,
- blockers,
- progress/evidence refs,
- closure reason.

It should not duplicate full feedback, documentation, or implementation briefs.

## Status semantics

Roadmap status should answer the work-state question, not the truth-state question.

Typical statuses:

- `todo`,
- `in_progress`,
- `blocked`,
- `verify`,
- `done`,
- `cancelled`.

The graph state machine owns reconciliation state such as drift, freshness, routing, and next loop.

## Gated agency support

For automated roadmap progress, roadmap state should expose:

- the next eligible work item,
- blocked and approval-required items,
- linked builds and knowledge paths,
- required validation gates,
- known risk level,
- evidence needed before closure.

The roadmap should not decide whether an agent may continue. It supplies work truth to the agency controller and graph state machine.

## Closure

Work should close only when:

- linked intent/spec/evidence is traceable,
- required checks ran or were explicitly deferred by policy,
- validation passed or closure policy explains why validation is not required,
- an implementation build or equivalent evidence brief exists for implemented changes.

## Migration warning

Current task folders under `.codewiki/roadmap/tasks/**` may contain stale generated shards. They are not target requirements briefs. The refactor should decide whether to regenerate or remove them after the new knowledge and graph model are stable.
