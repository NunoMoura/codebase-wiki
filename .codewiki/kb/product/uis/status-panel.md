---
id: spec.product.uis.status-panel
title: Status Panel UI
state: active
summary: Product expectations for compact host status, launch, and fallback CodeWiki navigation.
owners:
  - product
  - design
updated: "2026-05-12"
code_paths:
  - extensions/codewiki/src/adapters/pi/ui
---

# Status Panel UI

The status panel is the compact host-native status and fallback navigation surface for CodeWiki. The standalone [Control Room UI](control-room.md) is the primary rich visual product surface. The status panel should summarize health, focus, next action, gated agency state, task phase, evidence, and resume guidance while staying small enough to coexist with host surfaces.

The current Pi visual surface opens with `Alt+W`. Future host-native panels should preserve the same compact status semantics even when their shortcut, panel system, or rendering framework differs.

The status panel should also make the Control Room launch path discoverable when the host can open or print a local URL.

The status panel header shows only the repo name. Its user-facing sections should mirror the simplified second-screen Control Room model:

- Status — compact health, focus, graph/task metrics, gates, claims, blockers, drift/staleness counts, and next action.
- Product — source-backed summaries of users, stories, and visual UI surfaces.
- System — diagram picker or compact architecture preview backed by `.codewiki/kb/system/diagrams/**` and component docs.
- Board — tracked roadmap work, sprint/task scopes, task phase/detail navigation, gates, and closure evidence.
- Graph — source-of-truth links, scoped roadmap/sprint/task graph slices, build DAG edges, drift, and reconciliation cues.

The panel should not expose Knowledge, Builds, Validation, Diff, or Settings as permanent first-level tabs. Those details should appear only when they are relevant to the current selection, pending decision, gate, inspector detail, or chat workflow.

## Success signals

- Users can open a compact host-native status surface for health, inferred delta, gates, and tracked work.
- Users can see what needs attention without reading generated JSON.
- Status stays small and does not duplicate the agent chat or the standalone Control Room.
- Product and System sections route to canonical knowledge rather than hidden UI-only truth.
- Board and Graph focus on roadmap work and graph-backed relationships.
- Feedback diff decisions remain available when pending, but do not become a permanent navigation destination.
- The panel can act as a launcher or fallback for the standalone Control Room UI.
- Visual status reads graph-backed relationships, runtime pending diff tables, and roadmap work truth instead of duplicating them.

## Related docs

- [Maintainers](../users/maintainers.md)
- [Control Room UI](control-room.md)
- [Board UI](board.md)
- [Graph Navigation UI](graph-navigation.md)
- [Control Room UI System Component](../../system/control-room-ui.md)
- [Extension](../../system/extension.md)
