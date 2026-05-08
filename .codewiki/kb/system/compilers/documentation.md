---
id: spec.system.compilers.documentation
title: Documentation Compiler
state: active
summary: Turns an accepted feedback_build into updated knowledge and roadmap task packs.
owners:
  - architecture
updated: "2026-05-08"
code_paths:
  - skills/codewiki-plan/SKILL.md
  - extensions/codewiki/src/core/roadmap.ts
---

# Documentation Compiler

## Responsibility

The documentation compiler translates an accepted `feedback_build` into canonical knowledge updates and executable roadmap task packs.

## Flow

```text
accepted feedback_build
  -> inspect current .codewiki/kb and roadmap
  -> update knowledge docs
  -> create/update roadmap task packs
  -> documentation validation gateway
  -> documentation_build
  -> handoff to implementation compiler
```

## Build artifact

A `documentation_build` lives under `.codewiki/builds/documentation/`. It records:

- Which knowledge files changed.
- Which roadmap tasks were created or updated.
- Which task packs are ready for implementation.
- Which requirements are intentionally deferred or out of scope.

## Rules

- `.codewiki/kb/**` is canonical intended knowledge.
- Roadmap tasks are the executable delta from knowledge to reality.
- Keep decisions close to owning specs; do not create parallel ADR systems.
- Use `codewiki_state` first; expand raw files only when needed.
- Use `codewiki_task` for task creation. Do not edit roadmap JSON manually.
- If intent is ambiguous, escalate to the feedback compiler.

## Validation gateway

The documentation validation gateway checks:

- Vertical alignment: feedback_build -> knowledge -> roadmap/task packs.
- Horizontal alignment: knowledge docs agree, roadmap tasks agree.
- Task packs have outcome, acceptance, non-goals, verification steps.

## Related docs

- [Feedback Compiler](feedback.md)
- [Implementation Compiler](implementation.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
