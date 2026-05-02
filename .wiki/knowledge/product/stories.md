---
id: spec.product.stories
title: Product Stories
state: active
summary: Core jobs and outcomes CodeWiki should support.
owners:
  - product
updated: "2026-05-01"
---

# Product Stories

## Maintain fresh intent

As a maintainer, I want the wiki to preserve current project intent so future sessions do not rediscover goals from chat history or raw diffs.

Acceptance signals:

- Product and system knowledge describe the desired current state.
- Obsolete details are removed or converted into compact historical summaries.
- Roadmap tasks capture planned delta instead of mixing plans into long prose docs.

## Navigate with low token cost

As a Pi agent, I want to read compact generated views first so I can choose the right next context without loading the whole wiki into the session.

Acceptance signals:

- A tiny status view is the default first read.
- Views include revision metadata and recommended next reads.
- Task context views route agents to only the linked knowledge, code, and evidence needed for the current phase.

## Prevent horizontal and vertical drift

As a maintainer, I want CodeWiki to detect contradictions between docs, tasks, evidence, and code so the wiki remains trustworthy.

Acceptance signals:

- Drift views distinguish wiki-to-wiki drift from wiki-to-code/evidence drift.
- Tasks can be created from drift findings.
- Fresh verification checks task closure from a clean context.

## Resume and automate work safely

As a Pi user, I want CodeWiki to resume focused work or run bounded heartbeat cycles without losing alignment with user intent.

Acceptance signals:

- Session RAM is treated as volatile and expensive.
- Subagents handle context-heavy verification and research.
- Heartbeat modes have budgets, stop conditions, and write boundaries.
- Observe mode reports only, maintain mode refreshes/audits safe generated state, and work mode resumes roadmap tasks within explicit risk limits.

## Sanitize historical state

As a maintainer, I want hot wiki state to stay small while full history remains recoverable.

Acceptance signals:

- Git is the full historical recovery mechanism.
- Closed tasks retain compact semantic summaries.
- Views do not include cold history unless explicitly requested.

## Related docs

- [Product](overview.md)
- [Users](users.md)
- [Surfaces](surfaces.md)
- [Context Memory Flow](../system/flows/context-memory.md)
