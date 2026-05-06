---
id: system.flows.task-loop
title: Task Loop Flow
state: active
summary: Roadmap tasks route inner-loop execution from intent to implementation, verification, evidence, and closure.
owners:
  - architecture
updated: "2026-05-06"
code_paths:
  - scripts/rebuild_docs_meta.py
---

# Task Loop Flow

## Flow

Roadmap tasks route inner-loop execution from intent to implementation, verification, evidence, and closure.

## Rules

- Keep canonical truth and generated views separated.
- Expand exact canonical docs only when views are insufficient for the task.
- Do not close a task from parent-session confidence alone. Closure requires local/mechanical checks, a fresh verifier verdict when policy requires it, and compact evidence.
- The verifier is read-only. The parent process records evidence, closes, blocks, or creates follow-up tasks.

## Verification gate

The task loop uses the verification gateway with the `task-close` profile before closure. The gate should:

1. Validate that the task has outcome, acceptance criteria, non-goals, verification expectations, linked specs, and relevant code paths.
2. Check that required mechanical checks were run or that documented exceptions are acceptable.
3. Run a fresh-context semantic verifier against the task brief, linked knowledge, touched files, and evidence.
4. Parse and validate a deterministic `pass`, `fail`, or `block` verdict.
5. Append the verdict as evidence and block closure unless the verdict is `pass`.

## Related docs

- [System Overview](../overview.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
