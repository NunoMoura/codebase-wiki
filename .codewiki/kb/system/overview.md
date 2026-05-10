---
id: spec.system.overview
title: System Overview
state: active
summary: Main runtime areas and ownership boundaries for CodeWiki.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - extensions/codewiki
  - skills
---

# System Overview

## Main boundaries

CodeWiki maintains the repository-local `.codewiki/` contract and exposes it through agent-harness adapters. Pi is the only implemented adapter for now; the architecture keeps future Claude Code, Codex, CLI, MCP, or other harness adapters possible without making them immediate product commitments.

- **Knowledge base semantics** own product specs, visual UI specs, system access-surface specs, system specs, architecture rules, and workflow vocabulary under `.codewiki/kb/**`.
- **Agency controller** owns bounded roadmap automation through agency cycles and explicit token, time, risk, validation, policy, and approval gates.
- **Compiler builds** own validated intent, implementation-spec, and evidence briefs under `.codewiki/builds/**`.
- **Roadmap semantics** own work truth: priorities, active work items, status, progress, blockers, and closure state under `.codewiki/roadmap/**`.
- **Validation gateways** decide whether a loop can end and whether a build can be accepted for handoff. Failed, blocked, or policy-kept validation reports live under `.codewiki/validation/**`.
- **Graph state machine** owns generated reconciliation state in `.codewiki/index_graph.json`: drift detection, routing, derived queue order, loop selection, status, and freshness checks.
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
| Product and system truth | `.codewiki/kb/**/*.md` and `.codewiki/kb/**/*.json` | Durable intended behavior, product decisions, architecture, workflows, and non-goals. |
| Implementation spec truth | accepted `documentation_build` files under `.codewiki/builds/documentation/**` | Temporary implementation-spec brief for the implementation loop. |
| Work truth | `.codewiki/roadmap/**` | Active work items, priority, ownership, progress, status, blockers, and closure state. |
| State truth | `.codewiki/index_graph.json` | Generated graph state machine for reconciliation, drift detection, derived queue order, routing, status, and freshness. |
| Executable truth | code and tests | Final behavior and automated proof. |
| Evidence truth | accepted `implementation_build` files under `.codewiki/builds/implementation/**` | Temporary compiled evidence that changes were successfully implemented. |
| Validation truth | validation gateway output, plus persisted reports when required | Decides loop exit and records fail, block, or policy-kept validation outcomes. |
| Publication truth | implementation builds, validation outcomes, and Git/remote results | Supports commit messages, PR bodies, issue updates, release notes, and push readiness. |

Agents should not hand-edit generated graph/index files. Durable changes flow into knowledge, roadmap, code/tests, builds, or validation reports first; generated graph state is rebuilt afterward. If graph state and canonical inputs disagree, canonical inputs win and the graph is stale or broken.

Passing validation does not need a separate durable report by default when the accepted build records the validation result. Failed, blocked, policy-required, release, or audit-mode validation reports should be stored under `.codewiki/validation/**`.


## Compiler model

CodeWiki v2 uses three compilers and a validation gateway for the three loops:

- [Compilers](compilers.md) — feedback, documentation, and implementation loops that produce validated build briefs.
- [Validation Gateway](validation-gateway.md) — decides whether a loop can end and whether the next loop can consume the build.

```text
feedback loop -> validation gateway -> feedback_build
  -> documentation loop -> validation gateway -> documentation_build
    -> implementation loop -> validation gateway -> implementation_build
```

Builds are requirements or evidence briefs. They compact the result of one loop for the next loop; they are not permanent archives. Long-term product and system truth belongs in `.codewiki/kb/**`. Work truth belongs in roadmap state. Executable truth belongs in code and tests.

The roadmap does not duplicate full requirements briefs. Roadmap items reference the relevant accepted builds and knowledge paths, then track priority, state, progress, blockers, and closure.

The implementation build also supports publication. It should be suitable input for commit messages, PR bodies, issue updates, changelog or release-note drafts, and push-readiness checks. It can recommend publication actions, but validation and policy decide whether commit, push, release, or remote updates are allowed.

Each compiler handoff is guarded by a validation gateway. Gateways check both vertical alignment across layers and horizontal alignment inside each layer.

## Ownership seams

- [Architecture Map](architecture.mmd) is the component source map for the system architecture.
- [File Structure](file-structure.md) owns the target repository and knowledge-base structure rules.
- [API](api.md) owns the harness-independent CodeWiki access contract.
- [Extension](extension.md) owns packaged distribution and the current Pi extension surface.
- [Adapters](adapters.md) owns harness translation boundaries for Pi today and CLI/MCP/future harnesses later.
- [Agency Controller](agency.md) owns bounded roadmap automation through agency cycles and explicit gates.
- [Compilers](compilers.md) owns the feedback, documentation, and implementation loops.
- [Validation Gateway](validation-gateway.md) owns loop-exit validation semantics.
- [Builds](builds.md) owns temporary handoff brief semantics.
- [Graph](graph.md) owns the generated state-machine contract.
- [Knowledge](knowledge.md) owns product/system knowledge-base structure and persistence semantics.
- [Roadmap](roadmap.md) owns work truth: queue, priority, status, blockers, progress, and closure semantics.

CodeWiki should not implement a general sandbox or duplicate Pi observability/eval packages. It defines `.codewiki/` semantics and exposes them through a stable API that Pi, CLI, MCP, or future harness adapters can use safely.

## Target package architecture

The package should use a hybrid domain-driven design with three onion layers, minimal shared support, and harness adapters:

```text
extensions/codewiki/
  index.ts                 # thin package entrypoint
  bootstrap.ts             # adoption/bootstrap adapter surface until folded into Pi adapter
  templates.ts             # starter wiki template source
  src/
    domain/                # pure CodeWiki model, invariants, schemas, graph state-machine rules
    application/           # harness-agnostic use cases and ports
    infrastructure/        # filesystem, Git, process, persistence, graph rebuild implementations
    shared/                # minimal cross-cutting helpers/types only
    adapters/
      pi/                  # current Pi commands, tools, visual UI, lifecycle hooks, skills integration
      cli/                 # future directory only when implementation need exists
      mcp/                 # future directory only when implementation need exists
```

Dependency direction:

```text
adapters -> application -> domain
infrastructure -> application ports / domain contracts
shared -> no product behavior
```

Rules:

- `domain/**` has no Node I/O, no Pi imports, no adapter imports, and no infrastructure imports.
- `application/**` owns use-case orchestration and depends on domain contracts plus ports, not concrete infrastructure or adapters.
- `infrastructure/**` implements application ports and owns concrete side effects.
- `adapters/**` translate harness APIs into application use cases and translate results back into harness-specific commands, tools, visual UI, protocols, or messages.
- `shared/**` stays small and cannot own business semantics.
- `core/**` and `engine/**` must not exist in target source; former responsibilities now live under `domain/**`, `application/**`, `infrastructure/**`, and `adapters/**`.

`scripts/check-architecture.mjs` enforces target boundaries during `npm test`.

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
    architecture.mmd
    file-structure.md
    <component>.md
```

Product docs define users, user stories, and visual user interfaces. System docs define the technical architecture, API, adapters, and distribution mechanisms that implement product intent.

System docs should stay flat. Each component in `architecture.mmd` should have one matching `.md` file under `system/`, and each component should map to the project file structure. Avoid nested component folders and avoid `overview.md` files except `product/overview.md` and `system/overview.md`.

## Change-intent review loop

The feedback loop captures user intent with a critical eye. Its goal is not to accept a request blindly; it helps the agent and user find the best solution to the stated intention or problem. The loop should surface tradeoffs, blind spots, pitfalls, simpler alternatives, and conflicts with existing product, system, architecture, or code truth.

The target of an intended change can be product behavior, system design, architecture, workflow, documentation, tests, or code. CodeWiki must support propagation across layers instead of assuming a one-way flow. A code change can require documentation updates. A refactoring idea can start in feedback, propagate to documentation, and then become implementation work. Documentation drift can route back to feedback when intent is unclear.

When feedback proposes a change, the user should see a diff table before canonical edits are applied. Each row should show the current state, proposed state, rationale, affected docs or code, risk, and a user action such as approve, edit, reject, or defer. The table should make clear which components are targeted and how the change impacts adjacent layers.

Accepted rows compile into the feedback build. The graph state machine then routes the accepted change to the next needed loop: documentation, implementation, validation, or observe.

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
- [Extension](extension.md)
- [Agency Controller](agency.md)
