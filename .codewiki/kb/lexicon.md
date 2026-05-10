---
id: spec.lexicon
title: Lexicon
state: active
summary: Shared CodeWiki vocabulary for agents, humans, tasks, compiler builds, validation
  gateways, and generated graph views.
owners:
- product
- architecture
updated: '2026-05-09'
code_paths:
- .codewiki/kb
---

# Lexicon

## Canonical knowledge base

Durable current project truth under `.codewiki/kb/**`. It describes intended product behavior, visual product UIs, system access surfaces, system design, ownership seams, and workflow rules. It should not contain tests, raw transcripts, generated context packs, or event logs.

## Roadmap task

A tracked unit of active intended change. Tasks carry outcome, acceptance, non-goals, verification expectations, linked specs/builds/code paths, and evidence. Roadmap tasks are active work truth, not requirements briefs, chat to-do lists, or long-term archives. Closed or cancelled tasks should leave the hot roadmap after retention/checkpoint because git preserves full history.

## Sprint

A bounded work wave through the compiler pipeline. A sprint groups one or more roadmap tasks that share a feedback build, documentation build, and consolidated implementation build as evidence. Sprints replace informal "wave" terminology.

## Compiler

A CodeWiki workflow layer that validates one abstraction level and emits the smallest useful build artifact for the layer below.

## Feedback compiler

The compiler that turns user conversation and grounded reads into an accepted `feedback_build`. It validates that user intent, constraints, assumptions, blind spots, and non-goals are mapped before documentation changes are made.

## Documentation compiler

The compiler that turns an accepted `feedback_build` into updated `.codewiki/kb/**` knowledge, roadmap updates, and a `documentation_build` implementation-spec brief. It validates horizontal and vertical alignment before implementation work begins.

## Implementation compiler

The compiler that turns a `documentation_build` and roadmap work item into tests, code, checks, and an `implementation_build`. It follows TDD when practical and keeps tests in code/test directories instead of knowledge artifacts.

## Feedback build

A compact artifact under `.codewiki/builds/feedback/**` that records accepted user intent, decisions, constraints, unresolved ambiguities, and required downstream changes.

## Documentation build

A compact artifact under `.codewiki/builds/documentation/**` that records knowledge patches, roadmap changes, implementation specifications, alignment checks, and deferred requirements.

## Implementation build

A compact artifact under `.codewiki/builds/implementation/**` that records test/code changes, checks run, acceptance mapping, and implementation evidence.

## Validation gateway

A handoff gate that checks horizontal and vertical alignment for one compiler boundary. It can include deterministic preflight, mechanical checks, and a fresh read-only verifier. Passing validation need not be stored by default; failed, blocked, or policy-required reports are stored under `.codewiki/validation/**`.

## Gated agency

The user-facing product capability where an agent may advance roadmap work automatically inside explicit token, time, risk, validation, policy, and approval gates.

## Heartbeat

A system implementation mechanism for gated agency. A heartbeat cycle observes state, selects one bounded next action, checks gates, performs or declines the step, records evidence when needed, and stops or routes to the next loop. Heartbeat is not a product UI concept and not a fourth compiler.

## Verifier

A read-only fresh process, session, or subagent used inside a validation gateway. It returns a deterministic `pass`, `fail`, or `block` verdict and does not mutate canonical truth.

## Vertical alignment

Traceability through abstraction layers:

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> roadmap work item -> tests/code -> implementation_build
```

## Horizontal alignment

Coherence within a layer: knowledge docs agree with each other, roadmap tasks agree with each other, code components agree with each other, and tests agree with intended behavior.

## Index graph

The primary generated read model at `.codewiki/index_graph.json`. It maps knowledge, tasks, builds, tests, code components, and validation reports with typed nodes and edges. It is generated and must not be hand-edited. Curated Markdown links are inputs to the graph, but the graph owns exhaustive machine backlinks, stale-reference detection, freshness, and routing.

## Graph propagation

The graph's ability to hold the current state of all layers and, when any layer changes, expose what drifted downstream or upstream. Changing feedback triggers documentation drift. Changing knowledge triggers roadmap drift. Changing code triggers validation drift. The graph surfaces these as reconciliation items with explicit direction, layer, and next-loop routing so agents know exactly which loop needs to rerun — without manually tracing every consequence.

## View

A generated read model. In the target model, broad view trees are replaced by the graph-first index. Small status or queue files may exist as cached graph queries, but they are not canonical truth.

## Tester

An optional implementation worker that derives tests from a documentation build and roadmap work item before code changes. The tester helps reduce shared-context bias between test design and implementation.

## Builder

An optional implementation worker that changes code until documentation-build requirements, roadmap acceptance, tests, and required checks pass.

## Evidence

Compact proof or support for a claim. Research evidence supports knowledge and planning. Execution evidence supports implementation and closure.

## Context window

The active Pi agent session memory. It is volatile RAM and expensive because it is reloaded with each prompt in the session.

## Subagent

A fresh Pi agent invocation with a clean context window used for bounded work such as validation, research, planning review, architecture review, testing, or building.

## ThinkCode

An optional project-scoped sandbox runtime for agent-written programs. CodeWiki may interoperate with ThinkCode when installed, but CodeWiki must remain usable with native harness tools.

## Product UI

A visual user interface that a human can see and interact with, such as the status panel, board UI, graph navigation view, TUI screens, or editor panels. Product UI expectations live under `.codewiki/kb/product/uis/**`.

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
