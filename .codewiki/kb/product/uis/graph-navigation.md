---
id: spec.product.uis.graph-navigation
title: Graph Navigation UI
state: active
summary: Product expectations for visual graph-backed navigation in the Control Room.
owners:
- product
- design
updated: '2026-05-11'
code_paths:
- extensions/codewiki/src/adapters/web
- extensions/codewiki/src/adapters/pi/ui/manager.ts
---

# Graph Navigation UI

The graph navigation UI should make generated graph relationships visible and explainable to humans. It should help users understand current state, stale links, affected components, and safe next reads without turning generated graph state into hidden truth.

The standalone [Control Room UI](control-room.md) is the primary host for the rich graph view. Compact host panels may show smaller graph summaries or launch the Control Room.

Agent navigation belongs to the system graph/API contract; this document covers the visual experience.

Product expectations:

- render an interactive visual graph in the Control Room,
- keep a compact Graph tab or launcher available in host-native status panels,
- show graph nodes, edges, node/edge counts, build DAG edges, scoped roadmap/sprint/task slices, and the next reconciliation action,
- explain why a node, edge, missing link, or stale link matters,
- show affected product, system, roadmap, build, validation, test, and code layers,
- avoid broad context dumps,
- route from user intent to feedback diff rows, knowledge, roadmap work, builds, validation reports, tests, and code,
- make canonical source links visible,
- show sprint/task scoped graph slices when agency is bounded to a cohort or single task.

The Graph view is an inspection surface, not an editor. Selecting a node or edge opens a compact detail card with source paths and relationship meaning; canonical edits still flow through CodeWiki tools, API actions, and compiler loops.

## Success signals

- Users can see which graph node, edge, stale link, or missing link needs attention next.
- Users can distinguish generated graph state from durable product/system truth.
- UI panels use graph-backed relationships rather than duplicating canonical truth.
- Visual graph navigation supports horizontal and vertical alignment checks.

## Related docs

- [Low-Token Navigation](../stories/navigation.md)
- [Control Room UI](control-room.md)
- [Status Panel UI](status-panel.md)
- [Graph](../../system/graph.md)
