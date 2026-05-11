---
id: spec.system.extension
title: Extension
state: active
summary: Packaged CodeWiki distribution, current Pi extension surface, and Control Room launch integration.
owners:
  - architecture
  - engineering
updated: "2026-05-09"
code_paths:
  - extensions/codewiki/index.ts
  - extensions/codewiki/bootstrap.ts
  - extensions/codewiki/templates.ts
  - extensions/codewiki/src/adapters/pi
  - skills
  - scripts/smoke-test.mjs
  - scripts/check-architecture.mjs
---

# Extension

## Responsibility

The extension package distributes CodeWiki for the current Pi host runtime. It registers Pi commands, tools, compact visual status UI, Control Room launch integration, lifecycle hooks, packaged skills, bootstrap templates, and resource discovery, then delegates semantic work to the CodeWiki API.

The extension is not the product boundary. CodeWiki is the repo-local contract, compiler workflow, graph state machine, API, and standalone local Control Room. Pi is the current adapter and distribution channel.

## Current Pi surface

The Pi adapter owns:

- `/wiki-*` commands,
- `codewiki_*` tools,
- `Alt+W` compact visual status UI,
- `/wiki-ui [repo-path] [port]` to start the local Control Room, attempt to open its browser URL, and print a plain local URL fallback,
- `codewiki_agency` as the current Pi-facing agency controller entrypoint,
- session lifecycle hooks,
- packaged workflow skills,
- bootstrap/adoption entrypoints,
- package smoke and resource loading coverage.

## Package support files

- `extensions/codewiki/index.ts` should remain a thin entrypoint.
- `bootstrap.ts` owns adoption/bootstrap surface until folded into application/adapter ownership.
- `templates.ts` owns starter wiki templates.
- `project-root.ts` owns wiki-root discovery helpers.
- `mutation-queue.ts` owns local mutation serialization until replaced by infrastructure/application locking ports.

## Boundaries

- Pi SDK and TUI imports belong only in the Pi adapter.
- Browser UI and local web-server code must not depend on Pi SDK or Pi TUI packages.
- Pi-specific behavior must translate into API use cases, not own domain semantics.
- Pi/VCC/native compaction or session-reset hooks are adapter integration points. Core CodeWiki handoff truth lives in implementation builds, roadmap state, validation, and graph state, with safe adapter fallbacks when host compaction is unavailable.
- Agency behavior must enforce gated agency budgets and stop conditions instead of running unbounded work.
- The package should not become a general sandbox, hosted service, unbounded long-running runtime, or replacement for harness execution.
- Runtime checks must validate actual package loading under supported Node versions.
- Pi package imports use current `@earendil-works/*` names; deprecated `@mariozechner/*` imports must not reappear.

## Invariants

- Keep the public extension entrypoint small and stable.
- Keep harness-specific code inside adapters.
- Keep generated graph state read-only outside rebuild paths.
- Keep package smoke, typecheck, architecture check, and pack dry-run green after structural moves.
- Test runtime ESM/package loading, not only TypeScript typechecking.

## Related docs

- [Control Room UI](control-room-ui.md)
- [Adapters](adapters.md)
- [API](api.md)
- [File Structure](file-structure.md)
