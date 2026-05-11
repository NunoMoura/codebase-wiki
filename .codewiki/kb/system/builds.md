---
id: spec.system.builds
title: Builds
state: active
summary: Temporary compiler handoff briefs for intent, implementation specs, and implementation evidence.
owners:
  - architecture
updated: "2026-05-11"
code_paths:
  - .codewiki/builds
  - extensions/codewiki/src/application/builds.ts
  - extensions/codewiki/src/application/graph.ts
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
- optional tester evidence for test design and test files,
- optional builder evidence for code changes and implementation notes,
- acceptance mapping,
- validation verdict refs,
- unresolved issues or risks,
- recommended commit title/body,
- PR or issue update draft when useful,
- push-readiness notes such as branch, checks, version, changelog, and policy status.

The implementation build can recommend publication actions, but validation and policy decide whether commit, push, release, or remote updates are allowed. It may also carry compact handoff context for resume after closure or checkpoint: task id, linked specs/code, checks, validation refs, tester/builder evidence, next-focus suggestion, and a `/wiki-resume TASK-###` command. This handoff context supplements graph/roadmap state; it does not replace builds, roadmap, validation, or code/tests with chat transcript summaries.

## Lifecycle

```text
proposed -> accepted -> applied -> validated -> archived -> purged
```

Passing validation can be recorded in accepted build metadata. Failed, blocked, policy-required, release, or audit-mode validation reports should persist under `.codewiki/validation/**`.

## Consumption signals

Reconciliation should treat a build as consumed when lower-layer truth or validation evidence references it. Direct state mutation is not required before the graph can stop routing it as active drift.

A `feedback_build` is consumed when a downstream `documentation_build`, implementation evidence, or passing validation references that feedback build.

A `documentation_build` is consumed when it records roadmap changes, is referenced by implementation evidence, has passing validation evidence, or is explicitly knowledge-only because its source feedback has no roadmap/code delta.

An `implementation_build` is consumed when passing validation evidence references it or the build records a passing validation verdict. Accepted implementation evidence without validation still routes to the validation gateway.

## Related docs

- [Compilers](compilers.md)
- [Validation Gateway](validation-gateway.md)
- [Roadmap](roadmap.md)
