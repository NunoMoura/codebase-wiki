---
id: spec.system.file-structure
title: File Structure
state: active
summary: Target knowledge-base and package file structure for CodeWiki.
owners:
  - architecture
updated: "2026-05-12"
code_paths:
  - .codewiki/kb
  - extensions/codewiki
---

# File Structure

## Knowledge-base contract

Every CodeWiki project should use the same top-level knowledge-base shape:

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

At the `.codewiki/` root, active contract surfaces are limited to config, knowledge, roadmap, builds, validation, runtime coordination, sources/research support, and generated graph state. Legacy `.codewiki/index/` and default `.codewiki/evidence/**` surfaces are deprecated: `.codewiki/index_graph.json` is the generated index, implementation builds hold execution evidence, validation reports hold hot gateway decisions, and source/research support belongs under `.codewiki/sources/**` or an explicit `research_root`.

System component docs should stay flat. Each major system component should have one matching `.md` file under `system/`. Diagram raw data is the one intended nested system folder and lives under `system/diagrams/**`.

Avoid nested component folders and avoid `overview.md` files except `product/overview.md`, `system/overview.md`, and the diagram contract `system/diagrams/README.md`.

## Diagram raw-data contract

`system/diagrams/**` stores canonical, agent-editable raw diagram data. YAML is the default raw format because it is readable, diffable, and easier for agents to edit safely than dense diagram DSL.

The five default diagram families are:

| File | Diagram kind | Purpose | Renderer target |
| --- | --- | --- | --- |
| `diagrams/context-map.yaml` | Context map | Users, access surfaces, external systems, and project boundary. | Graph/SVG or Mermaid flowchart. |
| `diagrams/component-map.yaml` | Component/container map | Major runtime components, adapters, data stores, and dependency direction. | Cytoscape/custom SVG or Mermaid flowchart. |
| `diagrams/key-flow.yaml` | Key flow sequence | Most important user/agent workflow end to end. | Mermaid sequence diagram or custom sequence renderer. |
| `diagrams/data-model.yaml` | Data/domain model | Durable entities, generated state, evidence, and ownership. | Mermaid ER/custom ER renderer. |
| `diagrams/state-lifecycle.yaml` | State/lifecycle map | Task, compiler, validation, build, and release lifecycles. | Mermaid state diagram or custom state renderer. |

Renderer-specific Mermaid, Cytoscape, or SVG output should be treated as generated or renderer input unless a later task explicitly promotes a renderer-specific source file to canonical truth.

`system/architecture.mmd` is a compatibility source for the existing architecture renderer until the Control Room and status panel migrate to `system/diagrams/component-map.yaml`. New diagram work should target `system/diagrams/**`.

## Component-doc map

| Architecture node | Owning doc | Primary paths |
| --- | --- | --- |
| Control Room UI | `control-room-ui.md` | `extensions/codewiki/src/adapters/web/**`, Control Room launch commands |
| Extension | `extension.md` | `extensions/codewiki/index.ts`, package support files |
| Adapters | `adapters.md` | `extensions/codewiki/src/adapters/**`, `skills/**` |
| CodeWiki API | `api.md` | `extensions/codewiki/src/application/**`, domain contracts |
| Agency controller | `agency.md` | application use cases and adapter-exposed agency entrypoints |
| Compilers | `compilers.md` | compiler skills and application use cases |
| Validation gateway | `validation-gateway.md` | verifier skills, hot fail/block/policy-required/current validation reports |
| Knowledge | `knowledge.md` | `.codewiki/kb/**` |
| Builds | `builds.md` | `.codewiki/builds/**`, implementation evidence and publication payloads |
| Roadmap | `roadmap.md` | `.codewiki/roadmap.json`, active task state, release checkpoints, archive files |
| Parallel coordination | `api.md`, `adapters.md`, `graph.md` | `.codewiki/runtime/claims.json`, `codewiki_claim`, generated claim views |
| Graph state machine | `graph.md` | `.codewiki/index_graph.json`, graph rebuild implementation |

`system/diagrams/*.yaml` may also show external artifacts such as users, code/tests, and publication outputs. Those are not system component docs unless they become owned system components.

## CodeWiki system docs

The CodeWiki project should use this system set:

```text
.codewiki/kb/system/
  overview.md
  file-structure.md
  api.md
  extension.md
  adapters.md
  agency.md
  compilers.md
  validation-gateway.md
  builds.md
  graph.md
  knowledge.md
  roadmap.md
  control-room-ui.md
  architecture.mmd        # compatibility during diagram migration
  diagrams/
    README.md
    context-map.yaml
    component-map.yaml
    key-flow.yaml
    data-model.yaml
    state-lifecycle.yaml
```

Deprecated `.codewiki/` data paths that must not be recreated by new templates or normal agent writes:

```text
.codewiki/index/**
.codewiki/evidence/**
```

Legacy system KB paths removed by the flattening migration:

```text
.codewiki/kb/system/clients/**
.codewiki/kb/system/compilers/**
.codewiki/kb/system/components/**
.codewiki/kb/system/extensions/**
.codewiki/kb/system/flows/**
.codewiki/kb/system/runtime/**
.codewiki/kb/system/architecture.json
.codewiki/kb/system/v2-operating-model.md
```

## Package target layout

The package should use a hybrid domain-driven design with three onion layers, minimal shared support, and harness adapters:

```text
extensions/codewiki/
  index.ts
  bootstrap.ts
  templates.ts
  project-root.ts
  mutation-queue.ts
  src/
    domain/
    application/
    infrastructure/
    shared/
    adapters/
      pi/
      web/
```

Future adapter directories may be introduced only when there is an implementation need:

```text
extensions/codewiki/src/adapters/claude-code/
extensions/codewiki/src/adapters/codex/
extensions/codewiki/src/adapters/cli/
extensions/codewiki/src/adapters/mcp/
```

## Dependency direction

```text
adapters -> application -> domain
infrastructure -> application ports / domain contracts
shared -> no product behavior
```

Rules:

- `domain/**` has no Node I/O, no Pi imports, no adapter imports, and no infrastructure imports.
- `application/**` owns use-case orchestration and depends on domain contracts plus ports, not concrete infrastructure or adapters.
- `infrastructure/**` implements application ports and owns concrete side effects.
- `adapters/**` translate harness APIs, local web UI transport, or protocol surfaces into application use cases and translate results back into commands, tools, visual UI, protocols, or messages.
- `shared/**` stays small and cannot own business semantics.
- `core/**` and `engine/**` must not exist in the target implementation; former responsibilities now live under `domain/**`, `application/**`, `infrastructure/**`, and `adapters/**`.

## Current migration warning

The repository no longer contains transitional `core/**` or `engine/**` source folders. Generated task shards remain runtime outputs, not target source architecture.

Runtime checks must cover direct Node execution and package loading, not only TypeScript typechecking.

## Related docs

- [Architecture Diagram](architecture.mmd)
- [Diagram Raw Data](diagrams/README.md)
- [API](api.md)
- [Adapters](adapters.md)
