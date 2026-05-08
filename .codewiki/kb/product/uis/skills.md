---
id: spec.product.uis.skills
title: Skills UI
state: active
summary: Product expectations for agent-facing workflow skills shipped with CodeWiki.
owners:
  - product
updated: "2026-05-07"
code_paths:
  - skills
---

# Skills UI

Skills encode workflow policy for planning, task execution, research, validation, graph audit, and architecture review. They tell agents when to consume graph-backed state, when to expand exact canonical docs, and when to spawn focused workers.

Skills are an AI-facing interface. Their product job is to make correct workflow selection easy without turning every agent prompt into a large monolithic policy document.

## Success signals

- Skills route to the right compiler or validation gateway.
- Skills preserve the `.codewiki/` source-of-truth boundaries.
- General Pi skills can coexist without taking over CodeWiki roadmap/task semantics.

## Related docs

- [Package and Workflow Authors](../users/package-authors.md)
- [Agent Skills Client](../../system/clients/agent-skills.md)
