---
name: codewiki
description: Router and invariants for repo-local CodeWiki operation. Use when a repo needs wiki bootstrap, status review, roadmap visibility, or when deciding which focused CodeWiki workflow skill to load for planning, task execution, research, or verification.
---

# CodeWiki

Use this as the package router. Load a focused skill when the task matches a specific workflow:

- `codewiki-plan` — turn user intent into `.wiki/knowledge` updates and roadmap tasks.
- `codewiki-task` — execute roadmap tasks with implement → local verify → fresh verify → evidence.
- `codewiki-research` — gather cited/source evidence that supports `.wiki/knowledge`.
- `codewiki-verify` — verify task completion from fresh context.
- `codewiki-architecture` — review seams, locality, leverage, and roadmap-worthy architecture friction.

## Package surface

Public commands:

- `/wiki-bootstrap [project name] [--force]`
- `Alt+W` to toggle the live status panel
- `/wiki-config`
- `/wiki-resume [TASK-###]`

Internal agent tools:

- `codewiki_setup`
- `codewiki_bootstrap`
- `codewiki_state`
- `codewiki_task`
- `codewiki_session`

## Invariants

- `.wiki/knowledge/**` is canonical intended behavior.
- Roadmap tasks are the canonical active delta between knowledge and reality.
- Evidence is compact machine-managed validation or research support.
- Pi sessions are execution history linked to tasks, not roadmap truth.
- Prefer `codewiki_state` for reads, `codewiki_task` for roadmap mutation, and `codewiki_session` for runtime focus/notes.
- Do not hand-edit generated read models: `.wiki/graph.json`, `.wiki/lint.json`, `.wiki/roadmap-state.json`, `.wiki/status-state.json`.
- Do not hand-edit roadmap/event state when package tools can mutate it.
- Use `AGENTS.md` only for repo-specific policy layered on top of this package.

## Bootstrap/status flow

1. If `.wiki/config.json` is absent, use `/wiki-bootstrap` or internal `codewiki_setup`/`codewiki_bootstrap`.
2. If commands are missing after install, ask the user to run `/reload`.
3. Use `Alt+W` and `codewiki_state` as primary status surfaces.
4. If status is yellow/red, inspect deterministic status first before choosing an action.
5. If CodeWiki itself is unstable while editing this repo, stop using CodeWiki tools for the refactor, restore typecheck/test stability with plain tools, then update wiki/skills after checks pass.
