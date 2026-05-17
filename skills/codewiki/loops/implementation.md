# CodeWiki Implementation

Run the implementation compiler for one roadmap task. Prefer the dedicated `codewiki-implementation` skill for full implementation-mode instructions.

```text
validated planning_build + roadmap task + linked specs/code
  -> codewiki_state + source reads + artifact-status coordination
  -> test design / TDD where practical
  -> scoped edits + checks
  -> implementation_build
  -> fresh implementation validation
  -> task evidence / close only after required proof
```

## Rules

- Start implementation from the validated `planning_build` and roadmap task in a fresh session, fresh worker process, or recorded context reset; do not rely on prior compiler-loop chat memory. When the adapter exposes `codewiki_session_handoff`, use it instead of asking the user to run `/new` manually.
- Use `codewiki_session` when starting or continuing a task; keep task id, graph/build revisions, and current decision state in parent RAM.
- Use `codewiki_state` as the map, then read the planning build, roadmap item, linked builds, linked specs, validation reports, and code/test paths as sources of truth before changing behavior.
- Implement only self-contained executable tasks. If the selected item is an umbrella/container/epic, or its acceptance is mostly "other tasks close", stop and route grouping to the sprint/planning layer instead of implementing it.
- For semantic work, preserve `change_type` (`product`, `system`, `task`, or `code`) and accepted upstream build refs in implementation evidence; generated, runtime, or mechanical-only work may use traceability exemption metadata and `semantic=false` only when policy allows.
- Mark narrow write scopes with `codewiki_artifact_status` for non-trivial implementation work when parallel sessions may touch overlapping code, tests, docs, roadmap, builds, or validation refs.
- Read only linked sources unless graph drift/freshness signals or those sources prove broader context is needed.
- Tests live in code/test directories, not in `.codewiki/kb/**` or roadmap task folders.
- If task meaning is ambiguous, escalate to the feedback compiler.
- If knowledge, documentation build, planning build, or roadmap item is wrong/incomplete, return to the appropriate compiler instead of guessing.
- Use short local feedback loops during implementation: typecheck, tests, lint, runtime smoke, or targeted scripts.
- Compile `codewiki_build kind="implementation"` after edits/checks and before gateway validation.
- Validation evidence, not confidence, controls closure.
- Implementation/task-close validation must be performed from fresh validator context with clean-worktree and checked-content evidence when policy requires it. Use session handoff to start that validator context or worker process when policy/session budget allows.

## Tester/builder split

For small tasks, one agent may do both roles. For agent-created tests or bias-sensitive tasks, split:

- `tester`: consumes the planning build and roadmap item, then derives tests or test-design evidence before implementation where practical.
- `builder`: consumes the planning build, roadmap item, tester output, and required checks, then changes code until tests and acceptance pass.

The split is optional. Use it when independence matters more than coordination cost. The `implementation_build` should distinguish tester evidence from builder evidence so validation can review the split.

## Workflow

1. **Load implementation context**
   - Use graph/state only to locate relevant sources and freshness/drift signals.
   - Read the planning build, roadmap item outcome, acceptance, non-goals, validation expectations, linked specs, linked builds, validation reports, and code paths directly.
   - Confirm the roadmap item is self-contained executable work, not a sprint/umbrella/container task.
   - Confirm those sources are still aligned with current `codewiki_state`.

2. **Plan tests**
   - Identify existing tests and missing tests.
   - Add or update tests before code when practical.
   - If using a tester role, record tester output as test-design evidence.
   - If tests are not practical, record the reason as test-design evidence.

3. **Build**
   - Change only files required by the task.
   - Keep implementation scoped to acceptance criteria and non-goals.
   - If using a builder role, record builder output as code-change evidence.

4. **Mechanical checks**
   - Run relevant tests/typecheck/lint/smoke checks.
   - Record exact commands and outcomes.
   - Stop on failed checks unless the failure is unrelated and explicitly documented.

5. **Emit implementation build**
   - Call `codewiki_build kind="implementation"` before gateway validation.
   - Record task id, source planning build, `change_type`, traceability exemption when applicable, tests changed, code changed, tester evidence, builder evidence, checks, requirement/acceptance mapping, unresolved issues, and closure brief.
   - Include publication or commit-readiness recommendations when useful for task-close/publication policy.

6. **Fresh implementation validation**
   - Use `codewiki_session_handoff` with the implementation build ref, task id, changed files, checks, and expected validator output.
   - Validator checks acceptance one by one, vertical alignment from planning/task to tested behavior, horizontal alignment in touched code/tests, and content proof.
   - Validator records `fresh_context=true`, a clean-state value, and checked content proof such as `tree_sha`, `validated_sha`, or `working_tree_digest`.

7. **Record task evidence / close or block**
   - Use `codewiki_task action="update"` to append builder evidence and validation handoff details.
   - Use `codewiki_task action="close"` only after required passing validation/task-close proof exists.
   - A non-pass validation verdict blocks closure unless explicit policy allows an override.

## Fresh validation contract

A validator receives the planning build, roadmap item, linked knowledge paths, linked builds, touched code/test paths, tester evidence, builder evidence, checks run, implementation build, and unresolved issues. It starts from artifacts rather than builder chat context and records `fresh_context=true`, a clean-state value, and checked content proof. It returns `pass`, `fail`, or `block`. It does not mutate canonical truth.

## Output

End with changed files, checks run, `implementation_build` path, validation handoff path, task status recommendation, and remaining risks/follow-ups.

## Related skill files

- ../../codewiki-implementation/SKILL.md
- ../../codewiki-implementation/references/tools.md

## Related docs

- ../../../.codewiki/kb/system/compilers.md
- ../../../.codewiki/kb/system/validation-gateway.md
- ../../../.codewiki/kb/system/builds.md
