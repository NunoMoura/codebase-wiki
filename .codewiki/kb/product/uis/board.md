---
id: spec.product.uis.board
title: Board UI
state: active
summary: Product expectations for roadmap, inferred-delta, approvals, and next-action visibility.
owners:
  - product
  - design
updated: "2026-05-07"
---

# Board UI

The board UI should make tracked work, inferred delta, approvals, and next action visible inside Pi before users inspect raw machine state files. It is the live queue for closing gaps between `.codewiki/kb` and repository reality.

Roadmap tasks are the freshest delta log. Planning notes, drift findings, architecture candidates, validation failures, and implementation follow-ups should become structured tasks or task evidence instead of scattered prose buckets.

## Success signals

- Users can resume implementation from tracked roadmap focus.
- Decision gates are visible when approval or clarification is needed.
- Board labels can remain user-friendly while backend data remains roadmap/task based.
- Task packs include linked specs, outcome, acceptance criteria, non-goals, and validation expectations.

## Related docs

- [Resume and Automation](../stories/automation.md)
- [Status Panel UI](status-panel.md)
- [Roadmap Tasks](../../system/components/roadmap.md)
