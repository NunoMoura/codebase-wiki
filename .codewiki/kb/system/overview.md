---
id: spec.system.overview
title: System Overview
state: active
summary: Main runtime areas and ownership boundaries for CodeWiki.
owners:
  - architecture
updated: "2026-05-13"
code_paths:
  - extensions/codewiki
  - skills
---

# System Overview

## Main boundaries

CodeWiki maintains the repository-local `.codewiki/` contract and exposes it through agent-harness adapters and a standalone local Control Room UI. Pi is the only implemented harness adapter for now; the architecture keeps future Claude Code, Codex, CLI, MCP, or other harness adapters possible without making them immediate product commitments.

- **Knowledge base semantics** own product specs, visual UI specs, system access-surface specs, system specs, architecture rules, and workflow vocabulary under `.codewiki/kb/**`.
- **Agency controller** owns bounded roadmap automation through agency cycles and explicit token, time, risk, validation, policy, and approval gates.
- **Compiler builds** own cycle handoffs for validated intent, knowledge, planning, and implementation evidence under `.codewiki/builds/**`.
- **Roadmap semantics** own work truth: priorities, active work items, status, progress, blockers, and closure state under `.codewiki/roadmap/**`.
- **Validation gateways** validate submitted cycle builds against policy, source refs, criteria, and evidence. Hot failed, blocked, policy-kept, current-publication, or audit-required validation reports live under `.codewiki/validation/**`; cold pass reports rely on Git history/archive refs after publication.
- **Graph state machine** owns generated reconciliation state in `.codewiki/index_graph.json`: drift detection, routing, derived queue order, loop selection, status, and freshness checks.
- **Control Room UI** owns the standalone local browser command center for humans while delegating all semantics to the CodeWiki API.
- **Application layer** owns harness-agnostic use cases for setup, state, compiler loops, validation, roadmap mutation, session focus, and rebuild orchestration.
- **Domain layer** owns pure CodeWiki concepts, rules, entities, state-machine transitions, schemas, and invariants.
- **Infrastructure layer** owns filesystem, Git, process execution, persistence, graph rebuild implementations, and other concrete side effects behind application ports.
- **Adapters** own harness-specific translation. The Pi adapter owns current commands, tools, status panel, session integration, packaged skills, bootstrap surface, and resource discovery.
- **Shared** owns minimal cross-cutting helpers and types that are truly common; it must not become a dumping ground for domain or infrastructure behavior.

## Truth boundaries

CodeWiki separates truth by role so that agents can reason about the current state without treating every artifact as the same kind of source.

| Truth type | Lives in | Role |
| --- | --- | --- |
| Repo-local contract truth | `.codewiki/config.json` | Defines project roots, policy, generated files, and runtime settings. |
| Intent truth | accepted `feedback_build` files under `.codewiki/builds/feedback/**` | Temporary validated brief of user intent for the documentation loop. |
| Product and system truth | `.codewiki/kb/**/*.md`, `.codewiki/kb/**/*.yaml`, and `.codewiki/kb/**/*.json` | Durable intended behavior, product decisions, architecture, diagram raw data, workflows, and non-goals. |
| Knowledge handoff truth | accepted `documentation_build` files under `.codewiki/builds/documentation/**` | Temporary knowledge-alignment brief for the planning loop. |
| Planning handoff truth | accepted `planning_build` files under `.codewiki/builds/planning/**` | Temporary roadmap, acceptance, verification, and TDD-strategy brief for the implementation loop. |
| Work truth | `.codewiki/roadmap/**` | Active work items, priority, ownership, progress, status, blockers, and closure state. |
| Coordination state | `.codewiki/runtime/claims.json` | Temporary scoped change claims for parallel sessions; expires/releases and never replaces durable truth. |
| State truth | `.codewiki/index_graph.json` | Generated graph state machine for reconciliation, drift detection, derived queue order, routing, status, and freshness. |
| Executable truth | code and tests | Final behavior and automated proof. |
| Implementation evidence truth | accepted `implementation_build` files under `.codewiki/builds/implementation/**` | Temporary compiled evidence that changes were successfully implemented and publication payloads for Git-backed archival. |
| Validation truth | validation gateway output, plus persisted reports when required | Validates submitted builds and records hot fail, block, policy-kept, audit, or current-publication validation outcomes. Cold pass outcomes are recoverable from Git after publication. |
| Publication truth | implementation builds, validation outcomes, and Git/remote results | Supports commit messages, PR bodies, issue updates, release notes, and push readiness. |

Agents should not hand-edit generated graph/index files. Durable changes flow into knowledge, roadmap, code/tests, builds, or validation reports first; generated graph state is rebuilt afterward. Parallel coordination flows through scoped claims, not graph edits. If graph state and canonical inputs disagree, canonical inputs win and the graph is stale or broken.

Passing validation does not need a separate durable report by default when the accepted build records the validation result. Failed, blocked, policy-required, current publication, release, or audit-mode validation reports should be stored under `.codewiki/validation/**`. After safe Git archival/publication, pass validation reports are cold and should leave the hot working tree.


## Compiler model

CodeWiki's target alignment model uses four compiler loops and a pure validation gateway:

- [Compilers](compilers.md) — feedback, documentation, planning, and implementation loops that produce cycle builds.
- [Validation Gateway](validation-gateway.md) — validates a submitted build against policy, source refs, criteria, and evidence.

```text
feedback loop -> feedback_build -> validation gateway
  -> documentation loop -> documentation_build -> validation gateway
    -> planning loop -> planning_build -> validation gateway
      -> implementation loop -> implementation_build -> validation gateway/publication
```

A cycle build is one loop attempt. It contains criteria, requirement ids, source refs, evidence mapping, assumptions, risks, and non-goals for the gateway and the next fresh session.

Builds compact one loop for the next; they are not permanent archives. Long-term product/system truth belongs in `.codewiki/kb/**`, work truth in roadmap state, and executable truth in code/tests.

Roadmap items reference accepted builds and knowledge paths, then track priority, state, progress, blockers, and closure. In the target model, planning creates or refines roadmap work from validated documentation builds.

Implementation builds also support publication. They can recommend commit, PR, issue, release-note, and push-readiness text, but validation and policy decide whether commit, push, release, or remote updates are allowed.

Gateways check vertical and horizontal alignment, but they do not invent requirements or compile the next handoff.

## Ownership seams

- [Diagram Raw Data](diagrams/README.md) owns the canonical diagram families and agent-editable YAML sources for system visualizations.
- [Architecture Map](architecture.mmd) is a compatibility component diagram until System UI rendering migrates to `diagrams/component-map.yaml`.
- [File Structure](file-structure.md) owns the target repository and knowledge-base structure rules.
- [API](api.md) owns the harness-independent CodeWiki access contract.
- [Control Room UI](control-room-ui.md) owns standalone local web UI hosting and launch semantics.
- [Extension](extension.md) owns packaged distribution and the current Pi extension surface.
- [Adapters](adapters.md) owns harness translation boundaries for Pi today and CLI/MCP/future harnesses later.
- [Agency Controller](agency.md) owns bounded roadmap automation through agency cycles and explicit gates.
- [Compilers](compilers.md) owns the feedback, documentation, planning, and implementation loops.
- [Validation Gateway](validation-gateway.md) owns pure build-validation semantics.
- [Builds](builds.md) owns temporary handoff brief semantics.
- [Graph](graph.md) owns the generated state-machine contract.
- [Knowledge](knowledge.md) owns product/system knowledge-base structure and persistence semantics.
- [Roadmap](roadmap.md) owns work truth: queue, priority, status, blockers, progress, and closure semantics.

CodeWiki should not implement a general sandbox, hosted SaaS, or duplicate Pi observability/eval packages. It defines `.codewiki/` semantics and exposes them through a stable API and local Control Room that Pi, CLI, MCP, or future harness adapters can use safely.

## Target package architecture

The package follows the ports/adapters structure owned by [File Structure](file-structure.md): `adapters -> application -> domain`, with infrastructure behind application ports and minimal shared helpers. `scripts/check-architecture.mjs` enforces target boundaries during `npm test`.

## Knowledge-base organization rule

Every CodeWiki knowledge base should use the same high-level structure:

```text
.codewiki/kb/
  product/
    overview.md
    users/
    stories/
    uis/
  system/
    overview.md
    file-structure.md
    <component>.md
    diagrams/
      README.md
      context-map.yaml
      component-map.yaml
      key-flow.yaml
      data-model.yaml
      state-lifecycle.yaml
```

Product docs define users, user stories, and visual user interfaces. System docs define the technical architecture, API, adapters, distribution mechanisms, component ownership, and diagram raw data that implement product intent.

System component docs should stay flat. Each major component should have one matching `.md` file under `system/`, and each component should map to the project file structure. Diagram raw data is the intended nested system exception and lives under `system/diagrams/**`. Avoid nested component folders and avoid `overview.md` files except `product/overview.md`, `system/overview.md`, and `system/diagrams/README.md`.

## Change-intent review loop

The feedback loop captures user intent with a critical eye. Its goal is not to accept a request blindly; it helps the agent and user find the best solution to the stated intention or problem. The loop should surface tradeoffs, blind spots, pitfalls, simpler alternatives, and conflicts with existing product, system, architecture, or code truth.

The target of an intended change can be product behavior, system design, architecture, workflow, documentation, tests, or code. CodeWiki must support propagation across layers instead of assuming a one-way flow. A code change can require documentation updates. A refactoring idea can start in feedback, propagate to documentation, and then become implementation work. Documentation drift can route back to feedback when intent is unclear.

When feedback proposes a change, the user should see a diff table before canonical edits are applied. Each row should show the current state, proposed state, rationale, affected docs or code, risk, and a user action such as approve, edit, reject, or defer. The table should make clear which components are targeted and how the change impacts adjacent layers.

Accepted rows compile into the feedback build. The graph state machine then routes the accepted change to the next needed loop: documentation, planning, implementation, validation, or observe.

Architecture review is one input to this loop, not an automatic refactor pass. Reviews should look for real friction in module depth, seams, adapters, locality, leverage, testability, and code/spec ownership.

Findings become one of three things:

- a clarification to owning `.codewiki/kb/**` specs,
- a roadmap work item with acceptance criteria and validation expectations,
- an explicit non-goal or deferred decision.

When review exposes ambiguity, hidden risk, or unmapped user intent, the work escalates back to the feedback compiler.

## Related docs

- [Product](../product/overview.md)
- [Lexicon](../lexicon.md)
- [Architecture Map](architecture.mmd)
- [File Structure](file-structure.md)
- [API](api.md)
- [Control Room UI](control-room-ui.md)
- [Extension](extension.md)
- [Agency Controller](agency.md)
