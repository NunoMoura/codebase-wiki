---
name: codewiki-task
description: Automatic inner execution loop for CodeWiki roadmap tasks. Use when implementing, resuming, closing, or blocking a `TASK-###` with context, code changes, local checks, fresh verification, and evidence.
---

# CodeWiki Task

Run the inner loop. The user should not manually trigger verification stages.

```text
load task → create context → implement → local verify → fresh verify → evidence → close/block/follow-up
```

## Rules

- Use `codewiki_session` when starting or continuing a task; keep task id, loaded view revisions, and current decision state in parent RAM.
- Use `codewiki_state`/task context before reading raw wiki files.
- Read only linked specs, flows, evidence, and code paths unless task context proves broader context is needed.
- Use think-code for compact project context packets when exploration would be token-heavy.
- Spawn subagents for fresh verification or bounded research; parent consumes their compact result, then writes canonical task/evidence updates.
- Use short local feedback loops during implementation: typecheck, tests, lint, runtime smoke, or targeted scripts.
- Verification evidence, not confidence, controls closure.
- Use `codewiki_task` for evidence, close, block, or follow-up task creation.

## Workflow

1. **Load task**
   - Read task outcome, acceptance, non-goals, verification, linked specs, and code paths.
   - Check whether user intent or wiki knowledge conflicts with task text.

2. **Create context**
   - Prefer task context shard and think-code packets.
   - Expand linked specs/code only as needed.

3. **Implement**
   - Make surgical changes.
   - Keep scope inside acceptance criteria and non-goals.
   - For bugs, build or use a deterministic repro before fixing when possible.

4. **Local verify**
   - Run relevant checks.
   - Fix mechanical failures before fresh verification.

5. **Fresh verify**
   - Automatically invoke the verifier stage when task appears ready for closure or verification evidence is missing.
   - Route verifier-specific rubric to `codewiki-verify`.
   - Treat manual verifier commands as debug/override only.

6. **Record evidence and finish**
   - Append evidence with checks, files touched, issues, and verifier verdict.
   - Close only when acceptance criteria pass and verifier/local checks allow it.
   - If verifier fails or blocks, create follow-up tasks or mark blocked with evidence.

## Closure gate

A task may close only when:

- acceptance criteria are satisfied,
- required checks pass or exceptions are documented,
- fresh verifier passes or policy explicitly allows skipping,
- unresolved issues are either fixed, out of scope, or tracked as follow-ups.
