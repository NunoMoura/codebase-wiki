---
id: spec.product.uis.status-panel
title: Status Panel UI
state: active
summary: Product expectations for the compact status line and panel-first CodeWiki experience.
owners:
  - product
  - design
updated: "2026-05-07"
code_paths:
  - extensions/codewiki/src/adapters/pi/ui
---

# Status Panel UI

CodeWiki should summarize health, focus, next action, task phase, evidence, and resume guidance in a panel-first flow while keeping the optional one-line summary short enough to coexist with other Pi extensions.

The status panel header shows only the repo name. Its tabs are:

- Home — overall traffic-light status and influencing factors.
- Product — users, stories, and UIs.
- System — architecture graph with selectable components.
- Board — tracked work and next actions.

## Success signals

- `Alt+W` opens the primary control room for status, inferred delta, and tracked work.
- Humans can see what needs attention without reading generated JSON.
- Product and system tabs route to canonical knowledge rather than hidden UI-only truth.

## Related docs

- [Maintainers](../users/maintainers.md)
- [Board UI](board.md)
- [Pi Extension Client](../../system/clients/pi-extension.md)
