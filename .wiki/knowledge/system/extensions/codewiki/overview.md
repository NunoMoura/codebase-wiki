---
id: spec.extensions.codewiki.overview
title: Extensions / Codewiki
state: active
summary: Pi package resources, extension commands/tools, packaged skills, status UI, and generated wiki templates for codewiki.
owners:
  - engineering
updated: "2026-05-01"
code_paths:
  - extensions/codewiki
  - skills
  - scripts/smoke-test.mjs
---

# Extensions / Codewiki

## Boundary intent

This boundary owns the Pi-facing CodeWiki package surface: extension registration, commands, internal tools, status/config UI, packaged skills, bootstrap templates, smoke coverage for resource discovery, and project-root resolution.

It translates Pi interactions into CodeWiki semantic operations while keeping canonical meaning in `.wiki/knowledge`, roadmap tasks, evidence, and generated views. It should not become the general sandbox or long-running execution runtime; those responsibilities belong to Pi and optional runtime packages.

## Owned code areas

- `extensions/codewiki/index.ts` registers commands, tools, status panel behavior, task/session operations, and automatic verifier orchestration.
- `extensions/codewiki/bootstrap.ts` owns repo adoption/bootstrap behavior.
- `extensions/codewiki/templates.ts` owns starter wiki templates.
- `extensions/codewiki/contracts.ts` owns typed package contracts and tool schemas.
- `extensions/codewiki/project-root.ts` owns wiki-root discovery.
- `extensions/codewiki/mutation-queue.ts` owns local mutation serialization.
- `skills/**` owns progressive-disclosure agent workflow guidance shipped with the package.
- `scripts/smoke-test.mjs` verifies package resource loading and basic end-to-end bootstrap behavior.

## Collaborators

- Product, client, and system specs define intent and constraints.
- Runtime Policy defines the transaction/verifier/optional-runtime boundary.
- Pi provides extension APIs, sessions, package discovery, commands, tools, UI, and subprocess execution.
- Optional runtime tools may provide bounded programmatic context creation but do not own CodeWiki semantics.

## Invariants

- Keep public command surface small and Pi-native.
- Keep internal roadmap/session mutations behind CodeWiki tools and task APIs.
- Keep generated views read-only outside rebuild paths.
- Keep packaged skills focused and composable instead of one monolithic prompt.
- Preserve safe fallback behavior when optional runtimes are unavailable.

## Related docs

- [Product](../../../product/overview.md)
- [Clients Overview](../../../clients/overview.md)
- [System Overview](../../overview.md)
