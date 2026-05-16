---
id: spec.system.roadmap
title: Roadmap
state: active
summary: Work truth for active items, priority, status, blockers, progress, and closure.
owners:
  - architecture
updated: "2026-05-16"
code_paths:
  - .codewiki/roadmap/queue.json
  - .codewiki/roadmap
  - src/application/roadmap.ts
---

# Roadmap

## Responsibility

The roadmap owns active work truth. It records work that is todo, in progress, blocked, done, or cancelled while recently retained for handoff.

The roadmap can group related tasks into sprints. A sprint is a bounded cohort of tasks with a shared outcome, scope, budget, and closure checkpoint. Sprints help users and agency runs work at roadmap, sprint, or task granularity without turning CodeWiki into a full project-management suite.

The roadmap is not the long-term archive. Git preserves full historical task state. Builds and validation reports preserve semantic handoff/evidence when needed. Closed or cancelled tasks should leave the hot roadmap after a short retention window or release checkpoint.

The roadmap is not the requirements brief. Requirements live in accepted builds and durable knowledge. Roadmap items reference those sources and track execution state.

## Planning-loop ownership

The planning loop owns roadmap alignment in the target model. It consumes a validated `documentation_build` and produces a `planning_build` that creates or refines roadmap tasks.

A planning build should decide:

- which accepted requirements need executable work,
- whether existing active tasks should be refined or a new task should be created,
- task outcome, acceptance criteria, non-goals, blockers, and verification,
- candidate code and test paths,
- TDD or test-design strategy,
- requirement-to-task and requirement-to-test traceability.

Documentation builds update knowledge. Planning builds align roadmap work. Implementation builds prove tests/code changed correctly. Keeping those boundaries separate prevents roadmap tasks from becoming hidden requirements briefs and prevents documentation changes from silently implying implementation scope.

During migration, the documentation compiler may create the roadmap task required to implement planning-loop support. Once planning builds are supported by tools and state reconciliation, routine roadmap creation should come from the planning compiler.

## Progressive refinement

Roadmap work is progressively refined. When new user intent arrives, agents and API callers should first inspect active tasks and active sprint scope for related intent before creating new work. If an active task already covers the same spec paths, code paths, labels, or intent, the request should refine that task and its owning knowledge/sprint context instead of spawning a duplicate. A new task is appropriate when the intent is unrelated, when the existing work is closed or cancelled and no explicit task id was provided, or when the user intentionally asks for separate tracking.

Gated agency uses roadmap state as work truth. The state engine derives scoped views, queue order, and next-action routing, while the agency controller owns budgets, stop conditions, and autonomous step orchestration.

## Sprint contents

A sprint should record:

- id,
- title,
- outcome,
- status such as `planned`, `active`, `review`, or `closed`,
- task ids,
- scope across knowledge, roadmap, builds, validation, code, or tests,
- budget limits such as time, token, cost, write, session, and risk limits,
- closure gates such as validation, checkpoint, and garbage collection.

Future sprints can stay outcome-level. The active sprint should be decomposed into executable roadmap tasks. The canonical roadmap JSON supports a top-level `sprints` map; generated graph and roadmap state expose sprint ids, active sprint ids, task membership, scope, budget, and gates.

## Roadmap item contents

A roadmap work item should record:

- id,
- title,
- priority,
- status,
- owner or agent role when needed for durable work tracking,
- linked knowledge paths,
- linked build paths,
- linked code/test paths when known,
- concise outcome,
- acceptance summary,
- blockers,
- progress/evidence refs,
- closure reason.

It should not duplicate full feedback, documentation, planning, or implementation briefs. Refinement should be additive and concise: merge new source paths, labels, acceptance, non-goals, verification, and delta details while preserving the task id and existing closure criteria.

Roadmap ownership is durable work ownership. Parallel execution ownership belongs to the session queue: a session can temporarily lease affected knowledge paths, roadmap task state, build refs, validation refs, state refs, or code paths while the roadmap item continues to describe why the work exists and how it closes.

When a session cannot lease a needed scope because another active write lease owns it, the session may register a wait entry. Wait entries are runtime coordination records with TTL/heartbeat semantics. They record desired scopes, task/build context, and blocking lease ids; they become ready when no active blocking write lease remains. Ready wait entries should route agents back through current roadmap/build/scope artifacts rather than reviving stale waiting-session memory.

Session queue leases coordinate work ownership; worktrees isolate filesystem state; validation isolates judgment. A non-trivial writer, validator, or publisher session should use a dedicated worktree when concurrent work or dirty local state could affect the result. Session queue records may include role metadata (`builder`, `validator`, `publisher`, or `observer`) and optional worktree metadata such as path, branch, base SHA, head SHA, and clean status. This metadata helps reviewers understand who is doing what, but Git and the filesystem remain the source for actual worktree contents.

## Status semantics

Roadmap status should answer the work-state question, not the truth-state question.

Canonical active statuses:

- `todo`,
- `in_progress`,
- `blocked`.

Deprecated workflow statuses such as `research`, `implement`, and `verify` must not be emitted as roadmap status. Task phases are not canonical. Validation readiness belongs to validation gateway/build/commit-proof evidence, not to roadmap state.

Closure statuses may exist only as short-lived retained state:

- `done`,
- `cancelled`.

The state engine owns reconciliation state such as drift, freshness, routing, and next loop.

## Gated agency support

For automated roadmap progress, roadmap state should expose canonical sprint/task fields needed to derive:

- eligible work items by roadmap, sprint, or task scope,
- blocked and approval-required items,
- linked builds and knowledge paths,
- linked planning builds and requirement ids,
- required validation gates,
- configured time, token, cost, write, session, and risk budgets,
- known risk level,
- evidence needed before closure.

The roadmap should not decide whether an agent may continue or what queue order to present. It supplies work truth to the state engine and agency controller.

## Retention and history

Hot roadmap state should contain active sprints, active work, active session leases, unconsumed builds, fail/block validation, and any recently closed/cancelled work still needed for immediate handoff. Warm state contains recent pass evidence and accepted handoffs. Cold state contains consumed/validated history. Purgeable state contains expired runtime artifacts.

After sprint checkpoint or retention expiry, closed/cancelled task detail should move out of the active roadmap and rely on:

- Git history for full historical recovery,
- implementation builds for implementation evidence and publication payloads,
- validation reports for fail/block/policy-kept decisions,
- compact release or archive ledger rows for closed-work lookup.

Git-backed retention should treat Git as the cold immutable ledger and CodeWiki as the hot working set. The active roadmap should not keep full closed-task bodies once a closing implementation build is validated, a compact ledger row records the task or sprint id, archive ref, commit sha, digest, and restore command, and publication safety gates have passed. Custom refs such as `refs/codewiki/archive/task/TASK-###` or sprint-scoped refs can keep cold artifacts reachable without adding all old evidence to the active generated state. Commit trailers should carry the small discoverable summary needed to find the implementation build and archive ref.

Restoring old work should be explicit and lazy. A restore command can use Git refs, `git show`, worktrees, sparse checkout, or partial clone to hydrate a temporary context packet for refinement. Restored history is reference material, not current truth, until the user or documentation compiler turns it into new knowledge or active roadmap work.

Default CodeWiki operating context should hide cold roadmap and archive history. Agents, agency runs, status summaries, and user-facing graph views should not load closed-task detail, old pass validations, or archive restore indexes unless the user explicitly requests restore, archive inspection, audit, or refinement of historical work.

This keeps the roadmap useful as active work truth instead of an archive.

## Closure

Work should close only when:

- linked intent/spec/evidence is traceable,
- required checks ran or were explicitly deferred by policy,
- validation passed or closure policy explains why validation is not required,
- an implementation build or equivalent evidence brief exists for implemented changes.

In the target model, implementation closure should trace through a planning build unless the work is explicitly documentation-only, validation-only, or covered by a migration exception.

## Generated task views

Task folders under `.codewiki/roadmap/tasks/**` are generated task-view/context output rebuilt from `.codewiki/roadmap/queue.json`. They are not target requirements briefs and must not be hand-edited. Rebuilds regenerate missing task views and prune stale task directories that no longer exist in queue truth.

Current CodeWiki tooling predates the planning loop. Until the refactor is complete, agents must not treat a green graph or absent open tasks as proof that accepted feedback has propagated through documentation and planning.

## Related docs

- [Builds](builds.md)
- [Graph](graph.md)
- [Compilers](compilers.md)
- [Agency Controller](agency.md)
