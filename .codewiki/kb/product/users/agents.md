---
id: spec.product.users.agents
title: Pi Agents and Subagents
state: active
summary: AI agents that use CodeWiki as persistent project memory and compiler workflow state.
owners:
  - product
updated: "2026-05-07"
---

# Pi Agents and Subagents

Pi coding agents use CodeWiki as persistent project memory. They should consume generated graph/index state for navigation, update canonical knowledge and roadmap tasks when intent changes, and avoid loading raw history by default.

Subagents run focused work with fresh context windows. They support validation, research, architecture review, planning review, tester work, builder work, and other bounded tasks where isolated context reduces token cost and parent-session bias.

## Success signals

- Agents start from `codewiki_state` or graph-backed status before broad reads.
- Agents follow compiler artifacts: feedback build, documentation build, task pack, implementation build.
- Subagents return compact structured results rather than mutating canonical truth directly.
- Ambiguous intent escalates back to the feedback compiler instead of being guessed.

## Related docs

- [Low-Token Navigation](../stories/navigation.md)
- [Resume and Automation](../stories/automation.md)
- [Agent Tools UI](../uis/agent-tools.md)
- [Context Memory Flow](../../system/flows/context-memory.md)
