---
id: spec.product.uis.agent-tools
title: Agent Tools UI
state: active
summary: Product expectations for AI-facing CodeWiki tools.
owners:
  - product
updated: "2026-05-07"
---

# Agent Tools UI

Internal `codewiki_*` tools are the primary AI-facing interface. Agents should use:

- `codewiki_state` for compact reads,
- `codewiki_task` for roadmap task truth,
- `codewiki_session` for runtime focus notes,
- `codewiki_heartbeat` for bounded observe, maintain, or work cycles.

The tool UI should make the safe next action obvious while preserving compiler boundaries and validation gates.

## Success signals

- Agents do not need to inspect raw machine files for routine state.
- Tool results point to exact knowledge, task, build, validation, and code paths when deeper reads are needed.
- Semantic writes flow through CodeWiki task/session/transaction/build/validation capabilities.

## Related docs

- [Agents](../users/agents.md)
- [Pi Extension Client](../../system/clients/pi-extension.md)
