---
id: spec.system.knowledge
title: Knowledge
state: active
summary: Durable product and system knowledge structure for CodeWiki projects.
owners:
  - architecture
  - product
updated: "2026-05-09"
code_paths:
  - .codewiki/kb
---

# Knowledge

## Responsibility

Knowledge is the durable intended truth for product and system design. It is not a log, generated view, task archive, or code artifact store.

## Product structure

Product knowledge should define users, user stories, and visual user interfaces:

```text
.codewiki/kb/product/
  overview.md
  users/
  stories/
  uis/
```

Product docs should avoid technical implementation detail unless it affects user value, user constraints, or visual UI behavior.

## System structure

System knowledge should define the technical architecture that implements product intent:

```text
.codewiki/kb/system/
  overview.md
  architecture.mmd
  file-structure.md
  <component>.md
```

Each system component in `architecture.mmd` should have one matching `.md` file. Each component doc should map to code, data, adapters, or generated artifacts in `file-structure.md`. The diagram may include external artifacts such as users, code/tests, or publication outputs when needed for context; those are not system component docs unless ownership moves into CodeWiki.

## Rules

- Avoid nested `overview.md` files except `product/overview.md` and `system/overview.md`.
- Avoid a folder per system component.
- Keep current intended truth in knowledge; do not accumulate old decisions as raw history.
- Use Git for historical recovery.
- Use builds for temporary loop handoff briefs.
- Use roadmap for work truth.
- Use graph state for generated reconciliation and routing.
- Use code/tests for executable truth.

## Change propagation

A change can originate in any layer. Code changes can create documentation drift. Refactoring ideas can start in feedback, move through documentation, and become implementation work. Product changes can require system and code changes.

The feedback loop should expose change proposals with diff tables before canonical knowledge edits are applied.
