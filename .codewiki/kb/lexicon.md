---
id: spec.lexicon
title: Lexicon
state: active
summary: Shared CodeWiki vocabulary for agents, humans, tasks, compiler builds, validation gateways, and generated graph views.
owners:
  - product
  - architecture
updated: "2026-05-07"
---

# Lexicon

## Canonical knowledge base

Durable current project truth under `.codewiki/kb/**`. It describes intended product behavior, product UIs, system clients, system design, ownership seams, and workflow rules. It should not contain tests, raw transcripts, generated context packs, or event logs.

## Roadmap task

An atomic tracked delta from current reality to intended knowledge. Tasks carry outcome, acceptance, non-goals, verification expectations, linked specs, linked code paths, and evidence.

## Task pack

The compiled task context handed from the documentation compiler to the implementation compiler. A task pack contains enough acceptance, constraints, links, and verification expectations for an agent to implement the task without reloading unrelated knowledge.

## Compiler

A CodeWiki workflow layer that validates one abstraction level and emits the smallest useful build artifact for the layer below.

## Feedback compiler

The compiler that turns user conversation and grounded reads into an accepted `feedback_build`. It validates that user intent, constraints, assumptions, blind spots, and non-goals are mapped before documentation changes are made.

## Documentation compiler

The compiler that turns an accepted `feedback_build` into updated `.codewiki/kb/**` knowledge, roadmap updates, and task packs. It validates horizontal and vertical alignment before implementation work begins.

## Implementation compiler

The compiler that turns a task pack into tests, code, checks, and an `implementation_build`. It follows TDD when practical and keeps tests in code/test directories instead of knowledge artifacts.

## Feedback build

A compact artifact under `.codewiki/builds/feedback/**` that records accepted user intent, decisions, constraints, unresolved ambiguities, and required downstream changes.

## Documentation build

A compact artifact under `.codewiki/builds/documentation/**` that records knowledge patches, roadmap/task-pack changes, alignment checks, and deferred requirements.

## Implementation build

A compact artifact under `.codewiki/builds/implementation/**` that records test/code changes, checks run, acceptance mapping, and implementation evidence.

## Validation gateway

A handoff gate that checks horizontal and vertical alignment for one compiler boundary. It can include deterministic preflight, mechanical checks, and a fresh read-only verifier. Passing validation need not be stored by default; failed, blocked, or policy-required reports are stored under `.codewiki/validation/**`.

## Verifier

A read-only fresh process, session, or subagent used inside a validation gateway. It returns a deterministic `pass`, `fail`, or `block` verdict and does not mutate canonical truth.

## Vertical alignment

Traceability through abstraction layers:

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> roadmap task pack -> tests/code -> implementation_build
```

## Horizontal alignment

Coherence within a layer: knowledge docs agree with each other, roadmap tasks agree with each other, code components agree with each other, and tests agree with intended behavior.

## Index graph

The primary generated read model at `.codewiki/index_graph.json`. It maps knowledge, tasks, builds, tests, code components, and validation reports with typed nodes and edges. It is generated and must not be hand-edited.

## View

A generated read model. In the target model, broad view trees are replaced by the graph-first index. Small status or queue files may exist as cached graph queries, but they are not canonical truth.

## Tester

An optional implementation worker that derives tests from a task pack before code changes. The tester helps reduce shared-context bias between test design and implementation.

## Builder

An optional implementation worker that changes code until task-pack tests and required checks pass.

## Evidence

Compact proof or support for a claim. Research evidence supports knowledge and planning. Execution evidence supports implementation and closure.

## Context window

The active Pi agent session memory. It is volatile RAM and expensive because it is reloaded with each prompt in the session.

## Subagent

A fresh Pi agent invocation with a clean context window used for bounded work such as validation, research, planning review, architecture review, testing, or building.

## ThinkCode

An optional project-scoped sandbox runtime for agent-written programs. CodeWiki may interoperate with ThinkCode when installed, but CodeWiki must remain usable with native harness tools.

## Product UI

A human or AI-facing interaction experience, such as agent tools, commands, status panel, board UI, skills, TUI, CLI, MCP, package APIs, or future adapters. Product UI expectations live under `.codewiki/kb/product/uis/**`.

## System client

A technical distribution or adapter that delivers CodeWiki behavior, such as the Pi extension, packaged skills, CLI, TUI, MCP adapter, editor integration, service agent, or optional runtime program. System client details live under `.codewiki/kb/system/clients/**`.

## Sanitation

The policy that keeps hot CodeWiki state small. Knowledge stays fresh, graph/index state stays current, closed history moves to compact semantic summaries when needed, and full recovery relies on git plus harness session storage.

## Related docs

- [Product](product/overview.md)
- [System Overview](system/overview.md)
- [V2 Operating Model](system/v2-operating-model.md)
