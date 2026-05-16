---
name: codewiki
description: Router and invariants for repo-local CodeWiki operation. Use when a repo needs .codewiki bootstrap, status review, roadmap visibility, compiler routing, validation, graph-backed context, or CodeWiki-specific implementation work.
id: skill.codewiki
title: codewiki skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-14"
---

# CodeWiki

Use this as the single public CodeWiki skill. Load supporting workflow files only when the current task needs that detail:

- `loops/feedback.md` — feedback compiler: ground user intent, propose a diff table, and create accepted `feedback_build` handoffs.
- `loops/documentation.md` — documentation compiler: turn accepted feedback into `.codewiki/kb/**` updates, documentation builds, and planning handoffs.
- `loops/implementation.md` — implementation compiler: execute roadmap work from planning/build/task context with checks and evidence.
- `loops/validation.md` — validation gateway: independently judge horizontal and vertical alignment from fresh context.
- `playbooks/architecture.md` — architecture review for seams, ownership friction, testability gaps, and roadmap-worthy refactors.
- `playbooks/research.md` — external/source research workflow for evidence-backed knowledge and planning decisions.
- `playbooks/view-audit.md` — generated graph/index audit workflow.

Keep user-provided or repo-local research preferences outside CodeWiki when they are not CodeWiki-specific. CodeWiki owns the compiler loops, validation gateway, graph-backed context, and repo-local memory contract; other skills may own domain-specific research, writing, testing, or implementation style.

## Package surface

Public commands:

- `/wiki-bootstrap [project name] [--force]`
- `Alt+W` to toggle the compact live status panel
- `/wiki-ui [repo-path] [port]` to start the standalone local Control Room
- `/wiki-config`
- `/wiki-resume [TASK-###]`

Internal agent tools:

- `codewiki_setup`
- `codewiki_bootstrap`
- `codewiki_state`
- `codewiki_build`
- `codewiki_validation`
- `codewiki_task`
- `codewiki_claim`
- `codewiki_session`
- `codewiki_session_handoff`
- `codewiki_agency`

## Memory policy

- Treat the parent Pi context window as expensive session RAM: keep current user intent, focused task, loaded graph/build revisions, and small decisions only.
- Treat `.codewiki/kb/**`, roadmap tasks/queue, compiler builds, validation reports, and session queue state as persistent CodeWiki memory.
- Treat `.codewiki/index_graph.json` as the primary generated map/state index, not as canonical intent or execution truth. Extra cached status/queue files should be avoided unless a specific adapter needs them; if present, consume them as generated caches and do not hand-edit them.
- Default first read is `codewiki_state` or graph-backed status. Use it to locate exact knowledge, roadmap, build, validation, and code paths, then read those source-of-truth files directly before semantic edits.
- Use bounded context tools for programmatic filtering, validation, and context packets when raw repo output would be noisy. ThinkCode is optional; fall back to CodeWiki graph/gateway/native Pi tools when unavailable.

## Invariants

- `.codewiki/kb/**` is canonical intended knowledge.
- `.codewiki/roadmap/queue.json` is canonical active work truth: task records, ordering, and queue state. `.codewiki/roadmap/tasks/**` is generated task-view/context output rebuilt from queue truth and must not be hand-edited.
- `.codewiki/session/queue.json` is runtime coordination state for active, waiting, ready, released, or expired agent sessions and their scoped write leases.
- Compiler builds are compact transient handoff artifacts: `feedback_build`, `documentation_build`, `planning_build`, and `implementation_build`. They move through lifecycle states (`proposed`, `accepted`, `applied`, `validated`, `archived`) and can be purged after their lower-layer changes validate.
- Validation gateways check horizontal and vertical alignment at handoffs.
- Failed, blocked, or policy-required validation reports live under `.codewiki/validation/**`; passing validation need not be stored by default.
- Tests live in code/test directories, not in `.codewiki/kb/**` or task folders.
- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- Git is the full history mechanism; do not duplicate raw event history inside `.codewiki/`.
- Pi sessions are execution history linked to tasks, not roadmap truth.
- Session queue leases are temporary coordination aids for parallel work; claim narrow docs/roadmap/build/validation/code scopes before non-trivial semantic edits when overlap risk exists.
- When loop/gateway policy requires a fresh context and the adapter exposes `codewiki_session_handoff`, use that handoff instead of asking the user to manually create a new session. In Pi, tool-driven handoff may spawn a fresh worker process while `/wiki-session-handoff` remains the interactive replacement-session command.

## Compiler routing

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build
    -> planning compiler -> planning_build + roadmap work items
      -> implementation compiler -> implementation_build
```

Use `codewiki_build` after accepted feedback-loop decisions so the handoff becomes a real `feedback_build` artifact, not chat-only intent. Use `codewiki_build kind='documentation'` to record knowledge/roadmap changes, and `codewiki_build kind='implementation'` to record test/code/check evidence.

Use the feedback compiler as escalation whenever intent, requirements, risk, or roadmap item meaning is ambiguous.

## Agency policy

Agency modes are bounded:

- `observe`: read status/graph only and report next action.
- `maintain`: refresh/audit graph/index state and propose safe maintenance within write/subagent budgets.
- `work`: resume a roadmap task or compiler workflow only inside explicit cycle, wall-time, write, subagent, and risk budgets.

Stop on budget exhaustion, medium/high risk beyond budget, ambiguity, destructive action, failed checks, or missing approval. Push, version bump, and archive actions require policy permission plus green checks.

## Bootstrap/status flow

1. If `.codewiki/config.json` is absent, use `/wiki-bootstrap` or internal `codewiki_setup`/`codewiki_bootstrap`.
2. If commands are missing after install, ask the user to run `/reload`.
3. Use `/wiki-ui` for the rich local Control Room; use `Alt+W` and `codewiki_state` as compact status surfaces.
4. If CodeWiki itself is unstable while editing this repo, stop using CodeWiki tools for the refactor, restore typecheck/test stability with plain tools, then update knowledge/skills after checks pass.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
- ../../.codewiki/kb/system/graph.md
