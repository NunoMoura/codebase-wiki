---
id: spec.product.stories.sanitation
title: Sanitize Historical State
state: active
summary: CodeWiki should keep hot state small while full history remains recoverable through git and session storage.
owners:
  - product
updated: "2026-05-07"
---

# Sanitize Historical State

As a maintainer, I want hot CodeWiki state to stay small while full history remains recoverable.

## Acceptance signals

- Git is the full historical recovery mechanism.
- Pi session storage owns execution transcripts.
- Closed tasks retain compact semantic summaries when needed.
- Generated graph/index state does not include cold history unless explicitly requested.
- Raw event history is not stored by default.

## Related docs

- [Maintainers](../users/maintainers.md)
- [Sanitation and Release Flow](../../system/flows/sanitation-release.md)
- [V2 Operating Model](../../system/v2-operating-model.md)
