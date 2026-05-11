---
id: spec.product.uis.board
title: Board UI
state: active
summary: Product expectations for visual roadmap work, gated agency, approvals, and
  next-action visibility.
owners:
- product
- design
updated: '2026-05-09'
code_paths:
- extensions/codewiki/src/adapters/web
- extensions/codewiki/src/adapters/pi/ui/manager.ts
---

# Board UI

The board UI should make roadmap work, inferred delta, approvals, gates, blockers, and next actions visible before users inspect raw machine state files. In the standalone Control Room it should become the primary roadmap/work view; in host-native status panels it may remain a compact summary.

Roadmap work is work truth, not a requirements brief. Planning notes, drift findings, architecture candidates, validation failures, and implementation follow-ups should become structured work items or evidence instead of scattered prose buckets. Full intent and implementation specifications should live in accepted builds and linked knowledge.

## Success signals

- Users can resume implementation from tracked roadmap focus.
- Users can see which token, time, risk, validation, policy, or approval gate limits agent autonomy.
- Decision gates are visible when approval or clarification is needed.
- Board labels remain user-friendly while backend data remains roadmap/work based.
- Roadmap items link to documentation builds, specs, outcome, acceptance criteria, non-goals, validation expectations, and implementation evidence.

## Related docs

- [Use Gated Agency](../stories/automation.md)
- [Control Room UI](control-room.md)
- [Status Panel UI](status-panel.md)
- [Roadmap](../../system/roadmap.md)
- [Builds](../../system/builds.md)
