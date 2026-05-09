---
id: spec.system.file-structure
title: File Structure
state: active
summary: Target knowledge-base and package file structure for CodeWiki.
owners:
  - architecture
updated: "2026-05-09"
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
    architecture.mmd
    file-structure.md
    <component>.md
```

Product docs define users, user stories, and visual user interfaces. System docs define the technical architecture, API, adapters, and distribution mechanisms that implement product intent.

System docs should stay flat. Each component in `architecture.mmd` should have one matching `.md` file under `system/`. Each component doc should also map to concrete code, data, or adapter paths in this file.

Avoid nested component folders and avoid `overview.md` files except `product/overview.md` and `system/overview.md`.

## Component-doc map

| Architecture node | Owning doc | Primary paths |
| --- | --- | --- |
| Extension | `extension.md` | `extensions/codewiki/index.ts`, package support files |
| Adapters | `adapters.md` | `extensions/codewiki/src/adapters/**`, `skills/**` |
| CodeWiki API | `api.md` | `extensions/codewiki/src/application/**`, domain contracts |
| Agency controller | `agency.md` | application use cases and adapter-exposed heartbeat entrypoints |
| Compilers | `compilers.md` | compiler skills and application use cases |
| Validation gateway | `validation-gateway.md` | verifier skills, validation reports |
| Knowledge | `knowledge.md` | `.codewiki/kb/**` |
| Builds | `builds.md` | `.codewiki/builds/**` |
| Roadmap | `roadmap.md` | `.codewiki/roadmap/**` |
| Graph state machine | `graph.md` | `.codewiki/index_graph.json`, graph rebuild implementation |

`architecture.mmd` may also show external artifacts such as users, code/tests, and publication outputs. Those are not system component docs unless they become owned system components.

## CodeWiki system docs

The CodeWiki project should use this flattened system set:

```text
.codewiki/kb/system/
  overview.md
  architecture.mmd
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
- `adapters/**` translate harness APIs into application use cases and translate results back into harness-specific commands, tools, visual UI, protocols, or messages.
- `shared/**` stays small and cannot own business semantics.
- Transitional `core/**` and `engine/**` code should be migrated into the target layers or deleted.

## Current migration warning

The current repository still contains transitional `core/**`, `engine/**`, and generated task shards. These are migration sources, not the target architecture.

Runtime checks must cover direct Node execution and package loading, not only TypeScript typechecking. Node 26 exposed an extensionless TypeScript import failure in the current rebuild path; the refactor must fix runtime loading and packaging boundaries.
