---
id: spec.product.stories.navigation
title: Navigate With Low Token Cost
state: active
summary: Agents should start from compact graph-backed state and expand only to exact needed context.
owners:
  - product
updated: "2026-05-07"
---

# Navigate With Low Token Cost

As a Pi agent, I want to read compact generated graph/index state first so I can choose the right next context without loading the whole knowledge base into the session.

## Acceptance signals

- `codewiki_state` or graph-backed status is the default first read.
- Generated state includes revision metadata and recommended next reads.
- Task context routes agents to only the linked knowledge, code, builds, validation reports, and evidence needed for the current phase.
- Bounded context tools are optional microscopes, not required runtime dependencies.

## Related docs

- [Agents](../users/agents.md)
- [Graph Navigation UI](../uis/graph-navigation.md)
- [Generated Graph View](../../system/components/views.md)
- [Context Memory Flow](../../system/flows/context-memory.md)
