---
name: codewiki-implementation
description: Implementation compiler for CodeWiki roadmap tasks. Use when implementing, resuming, closing, or blocking a TASK-### with roadmap/build context, optional tester/builder work, checks, validation, implementation builds, and evidence.
id: skill.codewiki-implementation
title: codewiki-implementation skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki Implementation

Run the implementation compiler for one roadmap task.

```text
graph locates -> documentation_build + roadmap item + linked specs/code
  -> optional tester -> optional builder -> checks
  -> implementation validation -> implementation_build -> close/block/follow-up
```

## Rules

- Use `codewiki_session` when starting or continuing a task; keep task id, graph/build revisions, and current decision state in parent RAM.
- Use `codewiki_state` as the map, then read the roadmap item, linked builds, linked specs, validation reports, and code/test paths as sources of truth before changing behavior.
- Read only linked sources unless graph drift/freshness signals or those sources prove broader context is needed.
- Tests live in code/test directories, not in `.codewiki/kb/**` or roadmap task folders.
- If task meaning is ambiguous, escalate to the feedback compiler.
- If knowledge, documentation build, or roadmap item is wrong/incomplete, return to the documentation compiler.
- Use short local feedback loops during implementation: typecheck, tests, lint, runtime smoke, or targeted scripts.
- Validation evidence, not confidence, controls closure.

## Tester/builder split

For small tasks, one agent may do both roles. For agent-created tests or bias-sensitive tasks, split:

- `tester`: consumes the documentation build and roadmap item, then derives tests or test-design evidence before implementation where practical.
- `builder`: consumes the documentation build, roadmap item, tester output, and required checks, then changes code until tests and acceptance pass.

The split is optional. Use it when independence matters more than coordination cost.

## Workflow

1. **Load implementation context**
   - Use graph/state only to locate relevant sources and freshness/drift signals.
   - Read the roadmap item outcome, acceptance, non-goals, validation expectations, linked specs, linked builds, validation reports, and code paths directly.
   - Confirm those sources are still aligned with current `codewiki_state`.

2. **Plan tests**
   - Identify existing tests and missing tests.
   - Add or update tests before code when practical.
   - If using a tester role, record tester output as test-design evidence.

3. **Build**
   - Change only files required by the task.
   - Keep implementation scoped to acceptance criteria.
   - If using a builder role, record builder output as code-change evidence.

4. **Mechanical checks**
   - Run relevant tests/typecheck/lint/smoke checks.
   - Record exact commands and outcomes.

5. **Implementation validation**
   - Validate acceptance one by one.
   - Check vertical alignment from documentation build and roadmap item to tested behavior.
   - Check horizontal alignment inside code/tests touched by the task.
   - If tester/builder split was used, verify tester evidence, builder evidence, and checks line up.

6. **Emit implementation build**
   - Record task id, source documentation build when applicable, tests changed, code changed, tester evidence, builder evidence, checks, acceptance mapping, unresolved issues, validation refs, and publication/readiness recommendations under `.codewiki/builds/implementation/**` when useful.

7. **Close/block/follow-up**
   - Use `codewiki_task` for lifecycle mutation.
   - A non-pass validation verdict blocks closure unless explicit policy allows an override.

## Fresh validation contract

A validator receives the roadmap item, linked knowledge paths, linked builds, touched code/test paths, tester evidence, builder evidence, checks run, implementation build, and unresolved issues. It returns compact JSON with `pass`, `fail`, or `block`. It does not mutate canonical truth.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
