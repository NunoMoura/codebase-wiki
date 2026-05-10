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

The graph is the generated map and state index for CodeWiki. It is a rebuildable state machine over canonical inputs and discoverable code/test facts.

It routes agents to the smallest useful next context, detects drift, reports freshness, and selects the next loop: feedback, documentation, implementation, validation, or observe. It also supplies the agency controller with safe next-action and stop-reason signals.

The graph does not decide intended behavior and does not replace source-of-truth reads. It points to the relevant documentation builds, roadmap items, KB specs, validation reports, and code/test paths; agents must read those sources directly before making semantic changes.

## Inputs

The graph is generated from:

```text
.codewiki/config.json
.codewiki/kb/** frontmatter, paths, explicit refs, and curated Markdown links
.codewiki/builds/**
.codewiki/roadmap/**
.codewiki/validation/**
.codewiki/claims.json active scoped change claims
code/test manifests
Git/source fingerprints
```

Curated Markdown links are one input, not the full graph. The graph should compute backlinks, stale references, cross-layer traceability, freshness, and routing relationships so humans do not need to maintain exhaustive wiki-link meshes by hand.

## Output

The primary graph output is:

```text
.codewiki/index_graph.json
```

The graph should serve status, queue-order, and parallel-claim reads directly. Extra queue files should not be generated unless a future adapter proves a concrete performance need; if such caches exist, they are generated graph queries and never separate truth.

## State machine

The graph should model cross-layer items with:

- `state`: `aligned`, `drift`, `blocked`, `stale`, or `unknown`,
- `direction`: `downward`, `upward`, or `gateway`,
- `from_layer` and `to_layer`,
- `next_loop`: `feedback`, `documentation`, `implementation`, `validation`, or `observe`,
- `reason`,
- source fingerprints for freshness.

The graph-backed reconciliation gateway is a controller, not a fourth compiler. It reads graph state and routes work into existing loops. Gated agency consumes graph state during agency cycles, but the graph does not execute work itself.

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
- `derives_from`,
- `claim_task`,
- `claim_build`,
- `claim_scope`.

## Freshness

Graph state is valid only when it matches source fingerprints. If graph state and canonical inputs disagree, canonical inputs win and the graph is stale or broken.

## Invariants

- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- The graph must be reproducible from canonical inputs and source fingerprints.
- The graph should route to exact files instead of inlining large docs, code, logs, or old task history.
- The graph does not replace builds, knowledge, roadmap work items, validation reports, or code/tests; those remain the sources of truth.
- The graph should make gated agency stop reasons explicit when state is stale, blocked, unsafe, missing approval, or blocked by overlapping write claims.
- The graph should expose active claim counts, read/write warnings, and write/write conflicts, while claims remain temporary coordination state rather than source-of-truth behavior.
- The graph should own machine backlinks and exhaustive relationship discovery; knowledge docs should keep only intentional human-facing links.

## Related docs

- [Knowledge](knowledge.md)
- [Roadmap](roadmap.md)
- [Builds](builds.md)
- [Validation Gateway](validation-gateway.md)
