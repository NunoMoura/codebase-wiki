---
id: spec.product.stories.automation
title: Resume and Automate Work Safely
state: active
summary: CodeWiki should resume focus and run bounded heartbeat work without losing alignment with user intent.
owners:
  - product
updated: "2026-05-07"
---

# Resume and Automate Work Safely

As a Pi user, I want CodeWiki to resume focused work or run bounded heartbeat cycles without losing alignment with user intent.

## Acceptance signals

- Session RAM is treated as volatile and expensive.
- Subagents handle context-heavy validation and research.
- Heartbeat modes have budgets, stop conditions, and write boundaries.
- Observe mode reports only, maintain mode refreshes or audits safe generated state, and work mode resumes compiler or roadmap tasks within explicit risk limits.
- Ambiguous or unsafe work escalates to the feedback compiler.

## Related docs

- [Agents](../users/agents.md)
- [Board UI](../uis/board.md)
- [Implementation Compiler Flow](../../system/flows/task-loop.md)
