---
id: spec.product.uis.graph-navigation
title: Graph Navigation UI
state: active
summary: Product expectations for visual graph-backed navigation.
owners:
  - product
  - design
updated: "2026-05-09"
---

# Graph Navigation UI

The graph navigation UI should make generated graph relationships visible and explainable to humans. It should help users understand current state, stale links, affected components, and safe next reads without turning generated graph state into hidden truth.

Agent navigation belongs to the system graph/API contract; this document covers the visual experience.

Product expectations:

- show the next useful read or next useful decision,
- explain why a node, edge, missing link, or stale link matters,
- show affected product, system, roadmap, build, validation, test, and code layers,
- avoid broad context dumps,
- route from user intent to knowledge, roadmap work, builds, validation reports, tests, and code,
- make canonical source links visible.

## Success signals

- Users can see which graph node, edge, stale link, or missing link needs attention next.
- Users can distinguish generated graph state from durable product/system truth.
- UI panels use graph-backed relationships rather than duplicating canonical truth.
- Visual graph navigation supports horizontal and vertical alignment checks.

## Related docs

- [Low-Token Navigation](../stories/navigation.md)
- [Status Panel UI](status-panel.md)
- [Graph](../../system/graph.md)
