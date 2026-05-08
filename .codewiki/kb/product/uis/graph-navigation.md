---
id: spec.product.uis.graph-navigation
title: Graph Navigation UI
state: active
summary: Product expectations for graph-backed agent and UI navigation.
owners:
  - product
updated: "2026-05-07"
---

# Graph Navigation UI

Generated graph/index state is the main navigation interface for agents and UI. It should be small, revisioned, and purpose-specific enough to route work without becoming hidden truth.

Product expectations:

- show the next useful read,
- explain why a node or edge matters,
- avoid broad context dumps,
- route from user intent to knowledge, tasks, builds, validation reports, tests, and code,
- make stale or missing links visible.

## Success signals

- Agents can begin with `codewiki_state` or `.codewiki/index_graph.json` and then expand exact files only when needed.
- UI panels use graph-backed relationships rather than duplicating canonical truth.
- Graph output supports horizontal and vertical alignment checks.

## Related docs

- [Low-Token Navigation](../stories/navigation.md)
- [Generated Graph View](../../system/components/views.md)
