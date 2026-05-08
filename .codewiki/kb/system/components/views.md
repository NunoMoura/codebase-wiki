---
id: system.components.views
title: Generated Graph View
state: active
summary: Graph-first generated read model for agent routing, validation, and UI lenses.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - .codewiki/index_graph.json
---

# Generated Graph View

## Responsibilities

The target generated read model is `.codewiki/index_graph.json`. It is a graph-first index over canonical CodeWiki inputs. It is generated, deterministic, and never hand-edited.

Its job is context routing and alignment mapping. It should help agents, validation gateways, and UI surfaces find the smallest useful next read without creating a large view tree or hidden source of truth.

## Inputs

The graph is generated from canonical and discoverable inputs:

```text
.codewiki/kb/**
.codewiki/roadmap/**
.codewiki/builds/**
.codewiki/validation/**
code/test manifests
```

It may include links to generated or cached status lenses, but those lenses are derived from the graph and are not canonical.

## Node kinds

The graph should model at least these node kinds:

- `knowledge_doc`
- `roadmap_task`
- `feedback_build`
- `documentation_build`
- `implementation_build`
- `validation_report`
- `test_file`
- `code_component`
- `runtime_surface`

## Edge kinds

The graph should model typed alignment and routing edges:

- `captures_intent`
- `documents`
- `plans`
- `implements`
- `tests`
- `validates`
- `blocks`
- `depends_on`
- `drifts_from`
- `derives_from`

## Reconciliation state machine

The graph includes a rebuildable reconciliation view:

```text
views.reconciliation = {
  controller: "reconciliation_gateway",
  model: "graph-backed-state-machine",
  items: [...],
  counts_by_loop: {...},
  next_action: {...},
  layer_states: {...}
}
```

Each item tracks one cross-layer change with:

- `state`: `aligned`, `drift`, or `blocked`
- `direction`: `downward`, `upward`, or `gateway`
- `from_layer` / `to_layer`
- `next_loop`: `feedback`, `documentation`, `implementation`, or `observe`
- `reason`: why the gateway selected that route

The reconciliation gateway is a controller, not a fourth compiler. It reads graph state and routes work into an existing loop.

## Alignment model

The graph is the primary way CodeWiki maps vertical alignment:

```text
user intent
  -> feedback_build
  -> knowledge_doc
  -> documentation_build
  -> roadmap_task
  -> test_file/code_component
  -> implementation_build
  -> validation_report
```

It also maps horizontal alignment inside each layer:

```text
knowledge_doc <-> knowledge_doc
roadmap_task <-> roadmap_task
code_component <-> code_component
test_file <-> tested behavior
```

## Agent read path

The preferred read path is:

```text
codewiki_state or graph-backed status
  -> graph edge path
  -> exact canonical files
  -> bounded programmatic exploration only when graph/context is insufficient
```

Agents should not browse broad generated view folders. The graph routes them to exact files and explains why those files matter.

## Cached lenses

Small status, queue, or focus files may exist when UI or tools need fast reads. They should be treated as cached graph queries. They must be rebuildable from canonical inputs and the graph.

## Invariants

- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- Graph edges should explain why context is relevant.
- Graph output must stay small enough to route work; it should not inline broad knowledge, code, logs, or old task history.
- The graph does not replace compiler builds, validation reports, roadmap tasks, or knowledge docs.
- Free exploration with native harness tools or ThinkCode remains the fallback when the graph cannot answer a question.

## Migration note

Current code still contains legacy status, queue, and task-context view machinery. That machinery should be reduced until graph generation is the primary read model and any remaining lenses are cached graph queries.

## Related docs

- [System Overview](../overview.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
- [Context Memory Flow](../flows/context-memory.md)
