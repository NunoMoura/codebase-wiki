---
id: spec.clients.agent-skills
title: Agent Skills
state: active
summary: Compatibility guidance for global Pi skills alongside CodeWiki-specific workflow skills.
owners:
  - design
updated: "2026-05-01"
code_paths:
  - skills
  - README.md
---

# Agent Skills

## Intent

Global Pi skills should provide general engineering discipline without taking over CodeWiki's repository-local knowledge, roadmap, evidence, and task lifecycle semantics.

## Recommended global skills

These skills are good global candidates because they are useful across projects and do not require CodeWiki-specific state:

- `tdd` — red/green/refactor discipline for behavior-first implementation
- `diagnose` — reproduce/minimize/hypothesize/instrument/fix/regression-test loop for bugs
- `grill-me` — clarify ambiguous plans one question at a time
- `zoom-out` — ask for a higher-level map of unfamiliar code
- `write-a-skill` — author small, progressive-disclosure skills

## Avoid raw global install

These skills should not be installed globally without adaptation:

- `caveman` — already provided by the user's existing Pi setup
- `setup-matt-pocock-skills` — edits repo docs conventions that may conflict with CodeWiki
- `grill-with-docs` — assumes `CONTEXT.md` and `docs/adr`; adapt into CodeWiki planning instead
- `improve-codebase-architecture` — assumes non-CodeWiki docs and Claude-specific subagent terminology; adapt into `codewiki-architecture`
- `to-issues`, `to-prd`, `triage` — overlap CodeWiki roadmap/task semantics
- repo/personal/misc skills — evaluate per project, not globally

## Compatibility rules

- Do not change global Pi settings without explicit user approval.
- Review third-party skill/package source before installing; Pi packages run with broad local authority.
- Prefer CodeWiki-focused skills for `.wiki` planning, task execution, research, verification, and architecture review.
- Prefer general skills for coding discipline that does not mutate CodeWiki state.

## Related docs

- [Clients Overview](overview.md)
- [Roadmap Surface](surfaces/roadmap.md)
- [Product](../product/overview.md)
