---
id: spec.system.compilers.implementation
title: Implementation Compiler
state: active
summary: Turns roadmap task packs into tests, code, checks, and implementation_build evidence.
owners:
  - engineering
  - architecture
updated: "2026-05-08"
code_paths:
  - skills/codewiki-task/SKILL.md
  - extensions/codewiki/src/core/roadmap.ts
---

# Implementation Compiler

## Responsibility

The implementation compiler executes roadmap task packs. It turns specifications into tests, code changes, mechanical checks, and implementation build evidence.

## Flow

```text
task pack
  -> tester creates or updates tests (optional split)
  -> builder changes code
  -> mechanical checks pass (typecheck, tests, lint)
  -> implementation validation gateway
  -> implementation_build
  -> task close/block/follow-up
```

## Build artifact

An `implementation_build` lives under `.codewiki/builds/implementation/`. It records:

- Task id.
- Test files created or changed.
- Code files changed.
- Checks run and outcomes.
- Acceptance mapping.
- Unresolved issues.
- Validation gateway verdict or reason validation was deferred.

## Tester and builder roles

The implementation compiler can run as one agent for small tasks. For bias-sensitive or agent-created test work, split roles:

- `tester` reads the task pack and writes tests before implementation.
- `builder` reads the task pack and tests, changes code until checks pass.

The split is optional. Use it when independence matters more than coordination cost.

## Rules

- Tests live in code/test directories, not inside `.codewiki/kb/**` or task folders.
- Task packs describe what must be validated. Test files encode how.
- Do not close a task from confidence alone. Closure requires mechanical checks and compact evidence.
- If implementation reveals ambiguity, escalate to the feedback compiler.
- If implementation reveals wrong task packs, return to the documentation compiler.

## Task close

Task closure needs:
- Evidence with `checks_run` reflecting real commands and outcomes.
- Goal `outcome` and `acceptance` criteria mapped.
- Validation gateway opinion appended as evidence.

## Validation gateway

The implementation validation gateway checks:

- Tests and checks map to acceptance criteria.
- Code changes stay within scope.
- Horizontal alignment inside code and tests.
- Vertical alignment from task pack to tested behavior.

Passing validation may stay in evidence. Failed or blocked validation reports are stored under `.codewiki/validation/**`.

## Related docs

- [Documentation Compiler](documentation.md)
- [Feedback Compiler](feedback.md)
- [Implementation Compiler Flow](../flows/task-loop.md)
