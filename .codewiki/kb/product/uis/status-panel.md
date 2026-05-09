---
id: spec.product.uis.status-panel
title: Status Panel UI
state: active
summary: Product expectations for compact visual status and panel-first CodeWiki navigation.
owners:
  - product
  - design
updated: "2026-05-09"
code_paths:
  - extensions/codewiki/src/adapters/pi/ui
---

# Status Panel UI

The status panel is the primary visual control room for CodeWiki. It should summarize health, focus, next action, gated agency state, task phase, evidence, and resume guidance while keeping any optional one-line status compact enough to coexist with other host surfaces.

The current Pi visual surface opens with `Alt+W`. Future visual surfaces should preserve the same product experience even when their host shortcut, panel system, or rendering framework differs.

The status panel header shows only the repo name. Its tabs are:

- Home — overall traffic-light status, current focus, gates, and influencing factors.
- Product — users, stories, and visual UIs.
- System — architecture graph with selectable components.
- Board — tracked work, gated agency controls, approvals, and next actions.

## Success signals

- Users can open a primary visual status surface for health, inferred delta, gates, and tracked work.
- Users can see what needs attention without reading generated JSON.
- Product and system tabs route to canonical knowledge rather than hidden UI-only truth.
- Visual status reads graph-backed relationships and roadmap work truth instead of duplicating them.

## Related docs

- [Maintainers](../users/maintainers.md)
- [Board UI](board.md)
- [Graph Navigation UI](graph-navigation.md)
- [Extension](../../system/extension.md)
