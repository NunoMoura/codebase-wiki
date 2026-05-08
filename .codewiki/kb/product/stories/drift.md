---
id: spec.product.stories.drift
title: Prevent Horizontal and Vertical Drift
state: active
summary: CodeWiki should expose contradictions between knowledge, tasks, builds, validation reports, tests, and code.
owners:
  - product
updated: "2026-05-07"
---

# Prevent Horizontal and Vertical Drift

As a maintainer, I want CodeWiki to detect contradictions between docs, tasks, builds, validation reports, evidence, and code so the knowledge base remains trustworthy.

## Acceptance signals

- Drift signals distinguish horizontal drift inside a layer from vertical drift across layers.
- Tasks can be created from drift findings.
- Validation gateways judge handoffs from fresh context.
- Failed and blocked validation reports remain available for follow-up work.

## Related docs

- [Maintainers](../users/maintainers.md)
- [Generated Graph View](../../system/components/views.md)
- [Runtime Policy](../../system/runtime/overview.md)
