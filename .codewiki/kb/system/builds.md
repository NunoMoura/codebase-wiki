---
id: spec.system.builds
title: Builds
state: active
summary: Temporary compiler handoff briefs for intent, implementation specs, and implementation evidence.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - .codewiki/builds
---

# Builds

## Responsibility

Builds are temporary handoff briefs between loops. They compact validated intent, implementation specs, or implementation evidence so the next loop can work without relying on chat memory.

Builds are not permanent archives. They can be archived or purged after downstream truth absorbs them and validation confirms alignment.

## Build kinds

| Build | Produced by | Consumed by | Role |
| --- | --- | --- | --- |
| `feedback_build` | Feedback loop | Documentation loop | Compiled validated user intent. |
| `documentation_build` | Documentation loop | Implementation loop | Compiled implementation specs. |
| `implementation_build` | Implementation loop | Validation/publication/closure | Compiled evidence that changes were implemented successfully. |

## Feedback build

A feedback build should include:

- user intention or problem,
- accepted decisions,
- assumptions,
- open questions,
- non-goals,
- blind spots and risks surfaced during feedback,
- approved diff-table rows,
- expected lower-layer changes.

## Documentation build

A documentation build should include:

- knowledge files changed,
- implementation specs produced,
- roadmap work items created or updated,
- affected code/test areas,
- deferred requirements,
- validation expectations.

## Implementation build

An implementation build should include:

- roadmap work item ids,
- linked build and knowledge refs,
- files changed,
- tests and checks run with outcomes,
- acceptance mapping,
- validation verdict refs,
- unresolved issues or risks,
- recommended commit title/body,
- PR or issue update draft when useful,
- push-readiness notes such as branch, checks, version, changelog, and policy status.

The implementation build can recommend publication actions, but validation and policy decide whether commit, push, release, or remote updates are allowed.

## Lifecycle

```text
proposed -> accepted -> applied -> validated -> archived -> purged
```

Passing validation can be recorded in accepted build metadata. Failed, blocked, policy-required, release, or audit-mode validation reports should persist under `.codewiki/validation/**`.

## Related docs

- [Compilers](compilers.md)
- [Validation Gateway](validation-gateway.md)
- [Roadmap](roadmap.md)
