---
id: spec.extension.roadmap-ui
title: Roadmap State and TUI
state: active
summary: Derived status and roadmap read models plus first-party Pi status-dock rules for compact drift and task visibility inside codewiki.
owners:
- engineering
updated: '2026-04-17'
code_paths:
- extensions/codewiki/index.ts
- extensions/codewiki/templates.ts
- scripts/rebuild_docs_meta.py
---

# Roadmap State and TUI

## Intent

codewiki should keep roadmap and task truth in `wiki/roadmap.json`, but it should also expose a stable read model and a compact first-party TUI so users can track active work without leaving Pi or dumping the entire roadmap every turn.

## Canonical truth vs read model

Canonical write surfaces remain:

- `wiki/roadmap.json`
- Pi session JSONL plus codewiki custom task-link entries

The extension should also generate read-only UI models at `.wiki/roadmap-state.json` and `.wiki/status-state.json`.

Those files exist so:

- the built-in codewiki status dock can render quickly
- other UI extensions can consume status and roadmap state without mutating canonical files
- roadmap/task/status data can be denormalized for display without changing the source model
- current session focus can be overlaid live from Pi without writing extra repo-owned caches

## `.wiki/roadmap-state.json` contract

The derived state should be versioned and include enough denormalized data for UI consumers to render roadmap summaries without reparsing multiple canonical files.

Minimum expectations:

- generation timestamp
- deterministic wiki health snapshot (`green`, `yellow`, `red`) derived from lint output
- summary counts for total/open tasks plus status and priority counts
- ordered task id views for open, in-progress, todo, blocked, done, and recently updated tasks
- per-task denormalized display data including title, status, priority, kind, summary, labels, and spec/code links
- no repo-owned session index is required; current-session focus comes from Pi runtime state

Other extensions may read this file, but codewiki remains the only writer.

## Widget behavior

The first-party status dock should stay ambient and compact.

Default `standard` behavior:

- render above the editor when status state exists and dock mode is not `off`
- show a concise hero strip with repo label and health chip
- show tracked-drift and roadmap-completion bars
- show only the top risky specs instead of the full spec set
- show one strong next action
- prefer the current session's focused task or current repo under cwd when relevant
- allow pinned fallback when Pi runs outside a repo-local wiki root

## Progressive disclosure rule

The full roadmap remains available in docs and generated roadmap views, but the default Pi status dock should not dump every task or every spec. The TUI should optimize for the question:

- what is the current health?
- where is the worst drift?
- is roadmap covering that delta?
- what should the user do next?

## Compatibility rule

The public command surface stays:

- `/wiki-bootstrap`
- `/wiki-status`
- `/wiki-fix`
- `/wiki-review`
- `/wiki-code`

Roadmap/task TUI improvements should not require additional public commands beyond this core workflow. Richer UI affordances may be added later, but they should consume the same canonical roadmap/task model, plus live Pi session focus, and the same derived `.wiki/roadmap-state.json` and `.wiki/status-state.json` read contracts. One valid affordance is a repo picker that appears when a globally installed command runs outside any repo-local wiki root.

## Related docs

- [Extension Runtime](overview.md)
- [Status Dock v1](status-dock.md)
- [Product](../product.md)
- [System Overview](../system/overview.md)
- [Templates and Rebuild](../templates/overview.md)
- [Roadmap](../../roadmap.md)
