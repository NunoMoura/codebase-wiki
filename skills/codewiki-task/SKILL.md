---
name: codewiki-task
description: Implementation compiler for CodeWiki roadmap tasks. Use when implementing, resuming, closing, or blocking a TASK-### with task-pack context, tester/builder work, checks, validation, implementation builds, and evidence.
id: skill.codewiki-task
title: codewiki-task skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-07"
---

# CodeWiki Task

Run the implementation compiler for one roadmap task.

```text
task pack -> tester -> builder -> checks -> implementation validation -> implementation_build -> close/block/follow-up
```

## Rules

- Use `codewiki_session` when starting or continuing a task; keep task id, graph/build revisions, and current decision state in parent RAM.
- Use `codewiki_state` and task pack context before reading broad raw files.
- Read only linked specs, builds, validation reports, and code paths unless the task pack proves broader context is needed.
- Tests live in code/test directories, not in `.codewiki/kb/**` or roadmap task folders.
- If task meaning is ambiguous, escalate to the feedback compiler.
- If knowledge or task pack is wrong/incomplete, return to the documentation compiler.
- Use short local feedback loops during implementation: typecheck, tests, lint, runtime smoke, or targeted scripts.
- Validation evidence, not confidence, controls closure.

## Tester/builder split

For small tasks, one agent may do both roles. For agent-created tests or bias-sensitive tasks, split:

- `tester`: derives tests from the task pack before implementation.
- `builder`: changes code until task-pack tests and required checks pass.

The split is optional. Use it when independence matters more than coordination cost.

## Workflow

1. **Load task pack**
   - Read task outcome, acceptance, non-goals, validation expectations, linked specs, and code paths.
   - Confirm the task is still aligned with current `codewiki_state`.

2. **Plan tests**
   - Identify existing tests and missing tests.
   - Add or update tests before code when practical.

3. **Build**
   - Change only files required by the task.
   - Keep implementation scoped to acceptance criteria.

4. **Mechanical checks**
   - Run relevant tests/typecheck/lint/smoke checks.
   - Record exact commands and outcomes.

5. **Implementation validation**
   - Validate acceptance one by one.
   - Check vertical alignment from task pack to tested behavior.
   - Check horizontal alignment inside code/tests touched by the task.

6. **Emit implementation build**
   - Record task id, tests changed, code changed, checks, acceptance mapping, unresolved issues, and validation verdict under `.codewiki/builds/implementation/**` when useful.

7. **Close/block/follow-up**
   - Use `codewiki_task` for lifecycle mutation.
   - A non-pass validation verdict blocks closure unless explicit policy allows an override.

## Fresh validation contract

A validator receives the task pack, linked knowledge paths, touched code/test paths, checks run, implementation build, and unresolved issues. It returns compact JSON with `pass`, `fail`, or `block`. It does not mutate canonical truth.

## Related docs

- ../../.codewiki/kb/system/v2-operating-model.md
