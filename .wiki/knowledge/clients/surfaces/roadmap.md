---
id: spec.ux.surface.roadmap
title: Roadmap Surface
state: active
summary: TUI-first roadmap and inferred-delta experience for codewiki.
owners:
  - design
updated: "2026-04-29"
---

# Roadmap Surface

## Intent

The roadmap surface should make tracked work, inferred delta, approvals, and next action visible inside Pi before users inspect raw machine state files. It is the live queue for closing gaps between `.wiki/knowledge` and repository reality.

Roadmap tasks are the freshest delta log. Planning notes, drift findings, architecture candidates, and verification failures should become structured tasks or task evidence instead of scattered prose buckets.

## Outer planning loop

CodeWiki should turn user intent into an executable roadmap with minimal command choreography. A user may start planning with natural language, but the system should progress automatically through the safe stages:

```text
clarify → inspect → research if needed → update knowledge → create/update roadmap tasks
```

The loop pauses only for ambiguity, product or architecture choices, destructive actions, or explicit approval policy. Research belongs here when outside evidence is needed to support a knowledge claim; it should not be required during routine task execution.

Roadmap tasks created by the loop should include linked specs, outcome, acceptance criteria, non-goals, and verification expectations so implementation can proceed through the inner task loop without rediscovering intent.

## Related docs

- [Clients Overview](../overview.md)
- [Status Panel](status-panel.md)
- [System Overview](../../system/overview.md)
