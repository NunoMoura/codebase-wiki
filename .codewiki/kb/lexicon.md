---
id: spec.lexicon
title: Lexicon
state: active
summary: Shared CodeWiki vocabulary for agents, humans, tasks, compiler builds, validation
  gateways, and generated graph views.
owners:
- product
- architecture
updated: '2026-05-11'
code_paths:
- .codewiki/kb
---

# Lexicon

## Canonical knowledge base

Durable project truth under `.codewiki/kb/**`: intended product behavior, visual UIs, system access surfaces, design seams, and workflow rules. It should not contain tests, raw transcripts, generated packs, or event logs.

## Roadmap task

A tracked unit of active intended change with outcome, acceptance, non-goals, verification, linked specs/builds/code paths, and evidence. Tasks are active work truth, not requirements briefs, chat to-dos, or long-term archives. Closed or cancelled tasks should leave the hot roadmap after retention/checkpoint because git preserves full history.

## Sprint

A bounded work wave through the compiler pipeline. A sprint groups one or more roadmap tasks with a shared outcome, scope, budget, gates, and closure checkpoint. Sprints let agents and users scope execution at roadmap, sprint, or task level.

## Compiler

A CodeWiki workflow layer that validates one abstraction level and emits the smallest useful build artifact for the layer below.

## Feedback compiler

The compiler that turns user conversation and grounded reads into an accepted `feedback_build`. It validates that user intent, constraints, assumptions, blind spots, and non-goals are mapped before documentation changes are made.

## Documentation compiler

The compiler that turns an accepted `feedback_build` into updated `.codewiki/kb/**` knowledge, roadmap updates, and a `documentation_build` implementation-spec brief. It validates horizontal and vertical alignment before implementation work begins.

## Implementation compiler

The compiler that turns a `documentation_build` and roadmap work item into tests, code, checks, and an `implementation_build`. It follows TDD when practical and keeps tests in code/test directories instead of knowledge artifacts.

## Diff table

Feedback-loop decision surface that compares current state to desired state before canonical edits. Pending rows can live in runtime/session UI state and be approved, rejected, deferred, or edited with alternatives. Approved rows compile into a `feedback_build`.

## Feedback build

Compact artifact under `.codewiki/builds/feedback/**` for approved diff rows, accepted intent, decisions, constraints, ambiguities, and downstream changes.

## Documentation build

Compact artifact under `.codewiki/builds/documentation/**` for knowledge patches, roadmap changes, implementation specs, alignment checks, and deferred requirements.

## Implementation build

Compact artifact under `.codewiki/builds/implementation/**` for test/code changes, checks, acceptance mapping, closure brief, and implementation evidence.

## Closure brief

User-facing implementation summary that proves accepted intent moved through knowledge, roadmap, code/tests, checks, and validation. It belongs in the implementation build and should stay compact.

## Validation gateway

Handoff gate for horizontal and vertical alignment at one compiler boundary. It can include deterministic preflight, checks, and a fresh read-only verifier. Failed, blocked, or policy-required reports live under `.codewiki/validation/**`.

## Gated agency

User-facing capability where an agent advances roadmap work inside explicit token, time, risk, validation, policy, and approval gates.

## Agency

System mechanism for gated agency. A cycle observes state, selects one bounded next action, checks gates, performs or declines, records evidence when needed, and stops or routes to the next loop. Agency is not a product UI or fourth compiler.

## Verifier

A read-only fresh process, session, or subagent used inside a validation gateway. It returns a deterministic `pass`, `fail`, or `block` verdict and does not mutate canonical truth.

## Vertical alignment

Traceability across layers:

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> roadmap work item -> tests/code -> implementation_build
```

## Horizontal alignment

Coherence within one layer: knowledge, roadmap, code, and tests agree with peer artifacts.

## Index graph

Primary generated read model at `.codewiki/index_graph.json`. It maps knowledge, tasks, builds, tests, code, and validation reports with typed nodes and edges. It is generated and must not be hand-edited. Curated Markdown links are inputs; the graph owns machine backlinks, stale-reference detection, freshness, and routing.

## Graph propagation

The graph's ability to hold the current state of all layers and, when any layer changes, expose what drifted downstream or upstream. Changing feedback triggers documentation drift. Changing knowledge triggers roadmap drift. Changing code triggers validation drift. The graph surfaces these as reconciliation items with explicit direction, layer, and next-loop routing so agents know exactly which loop needs to rerun — without manually tracing every consequence.

## View

A generated read model. In the target model, broad view trees are replaced by the graph-first index. Extra status or queue files should be avoided unless an adapter proves a concrete performance need; if present, they are cached graph queries, not canonical truth.

## Tester

An optional implementation worker that derives tests from a documentation build and roadmap work item before code changes. The tester helps reduce shared-context bias between test design and implementation.

## Builder

An optional implementation worker that changes code until documentation-build requirements, roadmap acceptance, tests, and required checks pass.

## Evidence

Compact proof or support for a claim. Research/source evidence supports knowledge and planning and should live under source or research roots, not the deprecated default `.codewiki/evidence/**` root. Execution evidence supports implementation and closure and should live in `implementation_build` artifacts. Validation evidence is a gateway result; hot fail/block/policy-required/current reports live under `.codewiki/validation/**`, while cold pass reports rely on Git archival after publication.

## Context window

The active Pi agent session memory. It is volatile RAM and expensive because it is reloaded with each prompt in the session.

## Change claim

A temporary session-owned lease over narrow knowledge, roadmap, code, build, validation, or graph/source scopes. Claims coordinate parallel work and expire or release; they are not requirements, roadmap truth, or history.

## Subagent

A fresh Pi agent invocation with a clean context window used for bounded work such as validation, research, planning review, architecture review, testing, or building.

## ThinkCode

An optional project-scoped sandbox runtime for agent-written programs. CodeWiki may interoperate with ThinkCode when installed, but CodeWiki must remain usable with native harness tools.

## Product UI

A visual user interface that a human can see and interact with, such as the Control Room, status panel, board UI, graph navigation view, TUI screens, browser screens, or editor panels. Product UI expectations live under `.codewiki/kb/product/uis/**`.

Tools, commands, skills, CLI access, MCP access, package APIs, and harness adapters are access surfaces, not product UIs.

## System access surface

A technical distribution, adapter, or capability surface that delivers CodeWiki behavior, such as the Pi extension, packaged skills, CLI, MCP adapter, package API, editor integration, service agent, or optional runtime program. Adapter details live in `.codewiki/kb/system/adapters.md`, with stable access contracts in `.codewiki/kb/system/api.md`.

## Sanitation

The policy that keeps hot CodeWiki state small. Knowledge stays fresh, graph/index state stays current, closed history moves to compact semantic summaries when needed, and full recovery relies on git plus harness session storage.

## Related docs

- [Product](product/overview.md)
- [System Overview](system/overview.md)
- [Knowledge](system/knowledge.md)
- [Graph](system/graph.md)
- [Roadmap](system/roadmap.md)
