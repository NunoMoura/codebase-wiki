---
id: spec.system.builds
title: Builds
state: active
summary: High-signal cycle build contracts for intent, knowledge, planning, implementation evidence, and graph reconciliation.
owners:
  - architecture
updated: "2026-05-13"
code_paths:
  - .codewiki/builds
  - extensions/codewiki/src/application/builds.ts
  - extensions/codewiki/src/application/graph.ts
  - extensions/codewiki/src/domain/shared/types.ts
  - extensions/codewiki/src/adapters/pi/schemas.ts
---

# Builds

## Responsibility

Builds are temporary handoff contracts between alignment loops. They compact validated intent, knowledge updates, planning decisions, or implementation evidence so the next loop can work without relying on chat memory.

Builds are also cycle records. Each build represents one compiler attempt that can pass, fail, or block at the validation gateway. A later build may supersede a failed or blocked cycle.

Builds must be high-signal and low-noise. They should carry the smallest useful contract for the next layer plus enough evidence to prove intent was preserved across layers.

Builds are not permanent archives. They can be archived or purged after downstream truth absorbs them, validation confirms alignment, and Git publication preserves the cold history needed for explicit restore/audit.

## Build kinds

| Build | Produced by | Consumed by | Role |
| --- | --- | --- | --- |
| `feedback_build` | Feedback loop | Documentation loop | Compiled validated user intent. |
| `documentation_build` | Documentation loop | Planning loop | Compiled knowledge updates and requirement-to-KB mapping. |
| `planning_build` | Planning loop | Implementation loop | Compiled roadmap alignment, acceptance criteria, TDD plan, and code/test candidates. |
| `implementation_build` | Implementation loop | Validation/publication/closure | Compiled evidence that changes were implemented successfully. |

## Cycle contract

New builds should expose a cycle contract:

- `loop`: feedback, documentation, planning, or implementation,
- `cycle`: sequence, attempt id, supersedes refs, and status,
- `policy`: validation profile and exit criteria,
- `requirements`: stable requirement ids, text, source refs, and state,
- `source_refs`: upstream builds, knowledge files, roadmap tasks, validation reports, code/test refs, or user-approved diff rows used as inputs,
- `evidence_mapping`: criterion-to-evidence rows,
- `agent_assessment`: first-principles critique, disagreements, alternatives, and risk notes where relevant,
- `assumptions`, `open_questions`, `non_goals`, and `risks`,
- `consumes` and `produces` DAG refs.

Cycle builds should be created at loop-level handoff boundaries, not for every tool call or every red/green micro-step. TDD micro-steps belong in implementation evidence when they matter for acceptance.

## Feedback build

A feedback build should include:

- user intention or problem,
- approved diff-table rows,
- accepted decisions,
- agent assessment from first principles,
- assumptions,
- open questions,
- non-goals,
- blind spots and risks surfaced during feedback,
- expected lower-layer changes,
- requirement ids that downstream loops can trace.

The approved diff table is mandatory for new feedback builds because it is the user-facing intent contract. Each row records current state, desired state, rationale, affected layers, risk, and user action. Pending or rejected rows can live in runtime/session UI state; only approved rows become canonical feedback build content.

## Documentation build

A documentation build should include:

- source feedback build refs,
- knowledge files changed,
- requirement ids mapped to knowledge clauses,
- horizontal knowledge-alignment notes,
- deferred requirements,
- open planning questions,
- validation expectations,
- produced refs for the planning loop.

A documentation build is not the roadmap plan in the target model. It should not duplicate full roadmap tasks. During migration it may name the roadmap task needed to implement planning-loop support, but routine task creation belongs to `planning_build` once tooling exists.

## Planning build

A planning build should include:

- source documentation build refs,
- changed or required roadmap task ids,
- outcome and acceptance criteria for each task,
- non-goals and blockers,
- verification expectations,
- TDD or test-design strategy,
- candidate test files and code paths,
- requirement-to-task and requirement-to-test mapping,
- any human decision gates before implementation.

The planning build is the implementation-context brief. It should be compact enough for a fresh implementation session to start by reading the build, linked KB files, roadmap task state, and candidate code/test paths.

## Implementation build

An implementation build should include:

- source planning build refs,
- roadmap work item ids,
- linked build and knowledge refs,
- files changed,
- tests and checks run with outcomes,
- optional tester evidence for test design and test files,
- optional builder evidence for code changes and implementation notes,
- requirement and acceptance mapping,
- validation verdict refs,
- unresolved issues or risks,
- a mandatory closure brief,
- recommended commit title/body,
- PR or issue update draft when useful,
- push-readiness notes such as branch, checks, version, changelog, and policy status.

The closure brief is the user-facing proof that implementation satisfied the accepted intent. It should summarize original user intent, implemented changes, layers updated, acceptance evidence, checks, preserved non-goals, and remaining risks.

The implementation build can recommend publication actions, but validation and policy decide whether commit, push, release, or remote updates are allowed. It may also carry compact handoff context for resume after closure or checkpoint: task id, linked specs/code, checks, validation refs, tester/builder evidence, next-focus suggestion, and a `/wiki-resume TASK-###` command.

The implementation build is also the publication payload for Git-backed archival. CodeWiki should not introduce a separate archive capsule artifact. When work is safe to publish, the implementation build should contain or point to the commit/PR/release text, closure brief, checks, validation refs, artifact digests, recommended commit trailers, restore pointers, and any archive refs needed to recover the task or sprint from Git. A disciplined push can then publish the source branch plus a cold archive ref, while hot CodeWiki keeps only active work and compact ledger rows.

Publication metadata must remain recommendation-only until validation and user or policy approval allow it. Any Git or remote publication path must require secret scanning, remote visibility checks, and explicit handling for fail, block, policy-kept, or private evidence before pushing durable history to GitHub or another remote. Once publication succeeds and archive refs are reachable, consumed pass validation reports and cold implementation/documentation/feedback builds are eligible to leave the hot working tree; fail/block/policy-kept validation stays hot.

Implementation builds may also carry role and isolation evidence for the implementation loop. Builder evidence should identify the builder worktree and `head_sha` when available. Validation evidence should identify the fresh validator worktree and `validated_sha`. Publication evidence should identify the publisher worktree, generated-graph refresh, `published_sha`, and atomic push refs. These fields are metadata on the implementation build and validation reports; they are not a new build kind or archive capsule.

## Contract fields

New builds should expose explicit DAG fields:

- `consumes`: upstream build, roadmap, validation, or source refs this build depends on,
- `produces`: downstream knowledge, roadmap, code, test, validation, publication, or closure refs this build creates or updates.

Graph reconciliation should prefer these explicit edges over inferred legacy fields. Requirement traceability should use requirement ids and evidence mapping rather than prose matching.

## Lifecycle

```text
proposed -> accepted -> consumed -> validated -> archived -> purged
```

A build can also be superseded by a later cycle build after a fail or block verdict. Superseded builds remain useful for audit but should not stay in hot routing unless they still block the active cycle.

Passing validation can be recorded in accepted build metadata. Failed, blocked, policy-required, release, or audit-mode validation reports should persist under `.codewiki/validation/**`.

## Consumption signals

Reconciliation should treat a build as consumed when lower-layer truth or validation evidence references it. Direct state mutation is not required before the graph can stop routing it as active drift.

A `feedback_build` is consumed when a downstream `documentation_build`, implementation evidence, or passing validation references that feedback build.

A `documentation_build` is consumed when a downstream `planning_build`, passing validation, or explicit knowledge-only policy references it.

A `planning_build` is consumed when it creates or refines roadmap work and is referenced by implementation evidence, passing validation, or an implementation build.

An `implementation_build` is consumed when passing validation evidence references it, the build records a passing validation verdict, or a safe publication/archive ledger proves the implemented task has been published and can be restored from Git. Accepted implementation evidence without validation or publication safety still routes to the validation gateway.

## Related docs

- [Compilers](compilers.md)
- [Validation Gateway](validation-gateway.md)
- [Roadmap](roadmap.md)
- [Graph](graph.md)
