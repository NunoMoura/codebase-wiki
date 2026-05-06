---
id: system.components.views
title: Generated Views
state: active
summary: Tool-owned optimized read models and context routes consumed by agents, verifiers, and UI.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - .wiki/views
---

# Generated Views

## Responsibilities

Generated views are tool-owned read models consumed by agents, verifiers, and UI. They are not canonical truth. Their primary job is context routing: help an agent start from a tiny status packet, find the smallest useful task or sprint context, and expand to exact canonical docs or code only when needed.

Views act like a compiled index over the wiki and roadmap. They should expose map-like context, not become large RAG-style dumps.

## Context compiler model

CodeWiki treats view generation as a context compiler:

```text
canonical truth -> graph/state/lint -> compact role views -> exact source expansion
```

The default read path is:

```text
status -> queue -> role seed pack -> graph slice -> exact docs/code/evidence
```

A role seed pack gives enough information to choose the next bounded read or tool call. It should include reasons, links, stale state, and small decisive excerpts only when they prevent a larger read. It should not inline whole specs, broad code, or old task history.

Initial role packs:

- `grill`: ambiguity, risk, feasibility, missing user-intent mapping, and proposed questions before planning or implementation.
- `plan`: intended delta, affected knowledge, candidate roadmap/sprint/task mapping, and unresolved decisions.
- `build`: task outcome, acceptance criteria, linked specs/code, likely tests, and bounded exploration recipes.
- `verify`: acceptance/evidence matrix, checks, non-goals, changed paths, alignment signals, and exact reads needed by the verification gateway.

## Graph slices

Agents should not read the full graph by default. Generated graph slices should be scoped to a task, sprint, roadmap question, or verification profile.

Each slice should classify nodes into tiers:

- `core`: must read or inspect for the role.
- `supporting`: read only if ambiguity remains.
- `watch`: possible drift, blockers, stale evidence, or risky neighboring context.
- `excluded`: intentionally skipped high-cost or irrelevant paths with a reason.

Each entry should state why it appears, the edge path that selected it, and whether the link is explicit or inferred.

## Observability signals

Observability is not a gate. It is a set of alignment sensors consumed by agents, UI, and verification profiles.

Views should report:

- horizontal alignment: knowledge, roadmap tasks, evidence, generated views, and graph state agree with each other.
- vertical alignment: user intent and knowledge map through roadmap tasks to code paths, checks, and evidence.
- freshness: generated view revisions match canonical inputs.
- bloat: generated context stays within view size guarantees.
- missing links: specs without task/code mapping, tasks without specs/code/evidence, or evidence not attached to a task or claim.

Only the verification gateway returns `pass`, `fail`, or `block`. Observability supplies facts for that judgment.

## Programmatic exploration

Prebuilt views are cached routes. Bounded programmatic tools are the microscope. A good workflow can use both:

```text
small seed pack -> bounded sandbox/query over listed paths -> compact result -> exact source read if required
```

Generated views may include sandbox recipes or query hints, but they should not require a single runtime such as ThinkCode. When no sandbox is available, agents fall back to the seed pack, graph slice, and normal read/search tools.

## Size guarantees

Token budgets are generator and test constraints, not mental instructions the agent must maintain. Views may expose metadata such as `estimated_tokens`, `max_tokens`, and `over_budget`, but agents should mainly follow recommended next reads and warnings.

## Invariants

- Canonical changes must flow through knowledge, roadmap tasks, or evidence before views are rebuilt.
- Generated views are read models and must not be hand-edited.
- Views route context; they do not replace canonical knowledge, roadmap tasks, evidence, or verifier verdicts.
- Views should prefer paths, reasons, revisions, and bounded recipes over large embedded content.
- Generated context packs should be deterministic, stale-aware, and small enough for their role.

## Related docs

- [System Overview](../overview.md)
- [Context Memory Flow](../flows/context-memory.md)
- [Architecture Manifest](../architecture.json)
