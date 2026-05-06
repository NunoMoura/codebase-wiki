---
id: spec.extensions.codewiki.overview
title: Extensions / Codewiki
state: active
summary: Pi package resources, adapter boundary, commands/tools, packaged skills, status UI, and generated wiki templates for codewiki.
owners:
  - engineering
updated: "2026-05-05"
code_paths:
  - extensions/codewiki
  - skills
  - scripts/smoke-test.mjs
  - scripts/check-architecture.mjs
---

# Extensions / Codewiki

## Boundary intent

This boundary owns the packaged CodeWiki extension and its Pi integration surface. It translates Pi interactions into CodeWiki semantic operations while keeping canonical meaning in `.wiki/knowledge`, roadmap tasks, evidence, and generated views.

The package should not become the general sandbox or long-running execution runtime. Pi and optional runtime packages own those responsibilities. CodeWiki owns the repo-local wiki contract and the workflows that mutate or derive it.

## Current source layout

- `extensions/codewiki/index.ts` is the stable package entrypoint and delegates to the Pi adapter.
- `extensions/codewiki/src/adapters/pi/**` owns Pi-specific commands, tools, lifecycle hooks, shortcuts, status dock, status panel, and TUI rendering.
- `extensions/codewiki/src/core/**` owns transitional CodeWiki semantics and shared orchestration. It must not import Pi SDK/TUI packages or adapter modules.
- `extensions/codewiki/src/infrastructure/**` owns concrete file-system and rebuild execution implementations.
- `extensions/codewiki/src/engine/**` owns the canonical TypeScript view rebuild engine.
- `extensions/codewiki/src/domain/**` owns shared domain types and pure helpers used during the DDD migration.
- `extensions/codewiki/bootstrap.ts` owns repo adoption/bootstrap behavior.
- `extensions/codewiki/templates.ts` owns starter wiki templates.
- `extensions/codewiki/contracts.ts` owns typed package contracts and tool schemas.
- `extensions/codewiki/project-root.ts` owns wiki-root discovery helpers used by package-level commands/scripts.
- `extensions/codewiki/mutation-queue.ts` owns local mutation serialization.
- `skills/**` owns progressive-disclosure agent workflow guidance shipped with the package.
- `scripts/smoke-test.mjs` verifies package resource loading and basic end-to-end behavior.
- `scripts/check-architecture.mjs` enforces the current import-boundary guardrails.

## Adapter and core invariants

- Pi SDK and Pi TUI imports belong under `src/adapters/pi/**`.
- Core modules must not import `@mariozechner/*` packages or `src/adapters/**`.
- Domain modules must stay pure: no Node I/O, no Pi imports, no application/infrastructure/adapter imports.
- Application modules must stay agent-agnostic.
- Infrastructure modules must not import Pi adapter code.
- Package entrypoint should remain thin and stable.

## File and rebuild seams

Core project/prefs loading uses a file-store port shape so tests or future adapters can provide alternate storage without rewriting semantic code. The default implementation still uses Node filesystem infrastructure.

Rebuild execution uses a runner seam: core owns lock target calculation and runner invocation; infrastructure owns configured subprocess fallback and default TypeScript engine execution.

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
- Keep smoke, typecheck, architecture check, and pack dry-run green after structural moves.

## Related docs

- [Product](../../../product/overview.md)
- [Clients Overview](../../../clients/overview.md)
- [System Overview](../../overview.md)
- [CodeWiki Extension](../../components/extension.md)
- [View Rebuild](../../components/view-rebuild.md)
