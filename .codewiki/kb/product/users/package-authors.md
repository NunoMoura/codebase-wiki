---
id: spec.product.users.package-authors
title: Package and Workflow Authors
state: active
summary: Authors who extend CodeWiki through package resources, skills, adapters, or workflow policies.
owners:
  - product
updated: "2026-05-07"
---

# Package and Workflow Authors

Package and workflow authors use CodeWiki's structure and capability contracts without adopting CodeWiki as a sandbox, telemetry runtime, or general execution framework.

They need stable semantics for:

- state reads,
- task mutation,
- session focus notes,
- compiler builds,
- validation reports,
- graph/index rebuilds,
- packaged workflow skills.

## Success signals

- Authors can extend workflows without bypassing `.codewiki/` semantics.
- Skill packages compose with CodeWiki rather than replacing roadmap/task truth.
- Technical clients use typed capabilities for semantic writes.

## Related docs

- [Skills UI](../uis/skills.md)
- [Pi Extension Client](../../system/clients/pi-extension.md)
- [Agent Skills Client](../../system/clients/agent-skills.md)
