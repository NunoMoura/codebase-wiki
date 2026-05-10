---
name: codewiki
description: Router and invariants for repo-local CodeWiki operation. Use when a repo needs .codewiki bootstrap, status review, roadmap visibility, compiler routing, validation, or graph-backed context.
id: skill.codewiki
title: codewiki skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki

Use this as the package router. Load a focused skill when the task matches a workflow:

- `codewiki-feedback` — feedback compiler: ground user intent, propose feedback_build, accept before documentation.
- `codewiki-plan` — documentation compiler: turn accepted feedback into `.codewiki/kb/**` updates and roadmap/task packs.
- `codewiki-task` — implementation compiler: execute task packs with tester/builder work, checks, implementation builds, and closure evidence.
- `codewiki-research` — gather cited/source evidence that supports `.codewiki/kb/**` claims or planning decisions.
- `codewiki-verify` — validation gateway: independently judge horizontal and vertical alignment from fresh context.
- `codewiki-architecture` — review seams, locality, leverage, and roadmap-worthy architecture friction.
- `codewiki-view-audit` — graph/index audit: verify generated graph/index state against canonical sources and budgets.

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
- `codewiki_build`
- `codewiki_validation`
- `codewiki_task`
- `codewiki_session`
- `codewiki_agency`

## Memory policy

- Treat the parent Pi context window as expensive session RAM: keep current user intent, focused task, loaded graph/build revisions, and small decisions only.
- Treat `.codewiki/kb/**`, roadmap tasks, compiler builds, and validation reports as persistent CodeWiki memory.
- Treat `.codewiki/index_graph.json` as the primary generated read model. Extra cached status/queue files should be avoided unless a specific adapter needs them; if present, consume them as generated caches and do not hand-edit them.
- Default first read is `codewiki_state` or graph-backed status. Expand exact knowledge, roadmap, build, validation, and code paths only when the graph/build points there or exact source is required.
- Use bounded context tools for programmatic filtering, validation, and context packets when raw repo output would be noisy. ThinkCode is optional; fall back to CodeWiki graph/gateway/native Pi tools when unavailable.

## Invariants

- `.codewiki/kb/**` is canonical intended knowledge.
- Roadmap tasks are the canonical active delta between knowledge and reality.
- Compiler builds are compact transient handoff artifacts: `feedback_build`, `documentation_build`, and `implementation_build`. They move through lifecycle states (`proposed`, `accepted`, `applied`, `validated`, `archived`) and can be purged after their lower-layer changes validate.
- Validation gateways check horizontal and vertical alignment at handoffs.
- Failed, blocked, or policy-required validation reports live under `.codewiki/validation/**`; passing validation need not be stored by default.
- Tests live in code/test directories, not in `.codewiki/kb/**` or task folders.
- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- Git is the full history mechanism; do not duplicate raw event history inside `.codewiki/`.
- Pi sessions are execution history linked to tasks, not roadmap truth.

## Compiler routing

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build + task packs
    -> implementation compiler -> implementation_build
```

Use `codewiki_build` after accepted feedback-loop decisions so the handoff becomes a real `feedback_build` artifact, not chat-only intent. Use `codewiki_build kind='documentation'` to record knowledge/roadmap changes, and `codewiki_build kind='implementation'` to record test/code/check evidence.

Use the feedback compiler as escalation whenever intent, requirements, risk, or task-pack meaning is ambiguous.

## Agency policy

Agency modes are bounded:

- `observe`: read status/graph only and report next action.
- `maintain`: refresh/audit graph/index state and propose safe maintenance within write/subagent budgets.
- `work`: resume a roadmap task or compiler workflow only inside explicit cycle, wall-time, write, subagent, and risk budgets.

Stop on budget exhaustion, medium/high risk beyond budget, ambiguity, destructive action, failed checks, or missing approval. Push, version bump, and archive actions require policy permission plus green checks.

## Bootstrap/status flow

1. If `.codewiki/config.json` is absent, use `/wiki-bootstrap` or internal `codewiki_setup`/`codewiki_bootstrap`.
2. If commands are missing after install, ask the user to run `/reload`.
3. Use `Alt+W` and `codewiki_state` as primary status surfaces.
4. If CodeWiki itself is unstable while editing this repo, stop using CodeWiki tools for the refactor, restore typecheck/test stability with plain tools, then update knowledge/skills after checks pass.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
- ../../.codewiki/kb/system/graph.md
