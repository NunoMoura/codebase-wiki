---
id: system.flows.task-loop
title: Implementation Compiler Flow
state: active
summary: Roadmap task packs drive implementation through tester/builder work, mechanical checks, validation, implementation builds, and closure.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - extensions/codewiki/src/core/roadmap.ts
---

# Implementation Compiler Flow

## Flow

The implementation compiler receives a roadmap task pack from the documentation compiler and turns it into tests, code, checks, and an `implementation_build`.

```text
task pack
  -> tester creates or updates tests
  -> builder changes code
  -> mechanical checks pass
  -> implementation validation gateway
  -> implementation_build
  -> task close/block/follow-up
```

## Rules

- Keep knowledge and code separated. Tests live in code/test directories, not inside `.codewiki/kb/**` or task folders.
- Task packs describe what must be validated. Test files encode how behavior is validated.
- Prefer red-green TDD when a test can be written before the fix.
- Do not close a task from parent-session confidence alone. Closure requires mechanical checks, validation when policy requires it, and compact evidence.
- If implementation reveals ambiguity or missing intent, escalate to the feedback compiler.
- If implementation reveals wrong or incomplete knowledge/task packs, return to the documentation compiler.

## Tester and builder roles

The implementation compiler can run as one agent for small tasks. For agent-created tests or bias-sensitive work, split roles:

- `tester` reads the task pack and writes or updates tests before implementation.
- `builder` reads the task pack and tests, then changes code until checks pass.

The split is optional. Use it when independence matters more than coordination cost.

## Implementation validation gateway

The implementation validation gateway checks:

1. The task pack has outcome, acceptance criteria, non-goals, validation expectations, linked specs, and relevant code paths.
2. Tests and checks map to acceptance criteria.
3. Code changes stay within scope.
4. Horizontal alignment holds inside code and tests.
5. Vertical alignment holds from user intent through task pack to tested behavior.
6. Failed or blocked validation reports are stored under `.codewiki/validation/**`.

Passing validation may remain in memory or task evidence by policy; it does not need a durable validation report by default.

## Implementation build

An `implementation_build` should be compact and agent-first. It should record:

- task id,
- test files created or changed,
- code files changed,
- checks run,
- acceptance mapping,
- unresolved issues,
- validation verdict or reason validation was deferred.

## Related docs

- [System Overview](../overview.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
- [Runtime Policy](../runtime/overview.md)
