---
id: system.components.extension
title: CodeWiki Extension
state: active
summary: Pi package extension surface that exposes commands, status panel, skills, and agent tools through a thin adapter boundary.
owners:
  - architecture
updated: "2026-05-05"
code_paths:
  - extensions/codewiki/index.ts
  - extensions/codewiki/src/adapters/pi
---

# CodeWiki Extension

## Responsibilities

The CodeWiki extension is the Pi-facing adapter for the repo-local CodeWiki contract. It registers lifecycle hooks, commands, shortcuts, tools, and status UI, then delegates semantic work to core and infrastructure modules.

The public package entrypoint stays intentionally small: `extensions/codewiki/index.ts` calls the Pi adapter registrar under `extensions/codewiki/src/adapters/pi/index.ts`.

## Owned adapter areas

- `src/adapters/pi/index.ts` owns Pi extension registration, lifecycle hooks, `alt+w`, command registration, and tool registration.
- `src/adapters/pi/commands/**` owns `/wiki-*` command handling.
- `src/adapters/pi/tools/**` owns `codewiki_state`, `codewiki_task`, `codewiki_session`, and `codewiki_heartbeat` tool entrypoints.
- `src/adapters/pi/ui/**` owns status dock, status panel, theme rendering, and TUI-specific text width helpers.

## Collaborators

- `src/core/**` owns transitional CodeWiki semantics and must stay Pi-free.
- `src/infrastructure/**` owns concrete file-system and rebuild execution implementations.
- `src/engine/**` owns the canonical TypeScript rebuild engine.
- `bootstrap.ts`, `templates.ts`, `project-root.ts`, and `mutation-queue.ts` remain package-level collaborators during the migration.

## Invariants

- Keep `extensions/codewiki/index.ts` as a stable, thin package entrypoint.
- Keep Pi SDK and TUI dependencies inside `src/adapters/pi/**`.
- Keep core modules free of `@mariozechner/*` dependencies and adapter back-imports.
- Keep generated views read-only outside rebuild paths.
- Keep package smoke tests covering resource loading, bootstrap behavior, state/task/session tools, status UI, and pack contents.

## Related docs

- [System Overview](../overview.md)
- [Extensions / Codewiki](../extensions/codewiki/overview.md)
- [Architecture Manifest](../architecture.json)
