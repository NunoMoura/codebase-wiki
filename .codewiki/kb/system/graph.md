---
id: spec.system.graph
title: Graph
state: active
summary: Generated graph state machine for reconciliation, drift detection, routing, status, and freshness.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - .codewiki/index_graph.json
  - extensions/codewiki/src/infrastructure
---

# Graph

## Responsibility

The graph is the generated state truth for CodeWiki. It is a rebuildable state machine over canonical inputs and discoverable code/test facts.

It routes agents to the smallest useful next context, detects drift, reports freshness, and selects the next loop: feedback, documentation, implementation, validation, or observe. It also supplies the agency controller with safe next-action and stop-reason signals.

## Inputs

The graph is generated from:

```text
.codewiki/config.json
.codewiki/kb/**
.codewiki/builds/**
.codewiki/roadmap/**
.codewiki/validation/**
code/test manifests
Git/source fingerprints
```

## Output

The primary graph output is:

```text
.codewiki/index_graph.json
```

Optional status or queue lenses may exist for UI performance, but they are cached graph queries and not separate truth.

## State machine

The graph should model cross-layer items with:

- `state`: `aligned`, `drift`, `blocked`, `stale`, or `unknown`,
- `direction`: `downward`, `upward`, or `gateway`,
- `from_layer` and `to_layer`,
- `next_loop`: `feedback`, `documentation`, `implementation`, `validation`, or `observe`,
- `reason`,
- source fingerprints for freshness.

The graph-backed reconciliation gateway is a controller, not a fourth compiler. It reads graph state and routes work into existing loops. Gated agency may consume graph state during heartbeat cycles, but the graph does not execute work itself.

## Edges

Graph edges should explain why context is relevant. Useful edge kinds include:

- `captures_intent`,
- `documents`,
- `specifies`,
- `plans`,
- `implements`,
- `tests`,
- `validates`,
- `blocks`,
- `depends_on`,
- `drifts_from`,
- `derives_from`.

## Freshness

Graph state is valid only when it matches source fingerprints. If graph state and canonical inputs disagree, canonical inputs win and the graph is stale or broken.

## Invariants

- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- The graph must be reproducible from canonical inputs and source fingerprints.
- The graph should route to exact files instead of inlining large docs, code, logs, or old task history.
- The graph does not replace builds, knowledge, roadmap work items, validation reports, or code/tests.
- The graph should make gated agency stop reasons explicit when state is stale, blocked, unsafe, or missing approval.
