---
id: spec.product
title: Product
state: active
summary: Product intent and navigation for CodeWiki's users, stories, and UIs.
owners:
  - product
updated: "2026-05-07"
---

# Product

CodeWiki exists to keep repository intent fresh, explicit, and actionable for Pi coding agents and humans. It turns user intent, product decisions, system structure, roadmap tasks, compiler builds, validation reports, and evidence into repo-local memory that agents can maintain and consume efficiently.

The product tower owns user-facing intent:

- `users/**` describes who CodeWiki serves.
- `stories/**` describes jobs, outcomes, and acceptance signals.
- `uis/**` describes human and AI-facing interaction expectations.
- [Lexicon](../lexicon.md) defines shared project vocabulary.

Folders do not need `overview.md` files by default. Add a navigation page only when the folder becomes hard to scan or needs explicit ownership rules.

## Product boundaries

CodeWiki owns the `.codewiki` contract, canonical knowledge, roadmap tasks, compiler builds, validation reports, generated graph/index state, and Pi-native workflows around them. It should not become a general-purpose sandbox, telemetry stack, evaluation framework, or monolithic runtime.

Product UI docs describe the experience that humans and agents should have. System client docs describe the technical distribution and adapter mechanisms that deliver those experiences.

## Success signals

- User intent is captured before implementation expands.
- Product stories map to roadmap tasks and system components.
- Agents consume compact graph/index state instead of rereading the entire knowledge base.
- Knowledge remains fresh while historical recovery relies on git, session storage, and compact semantic summaries.
- Pi sessions can resume work through roadmap tasks and generated graph-backed context.

## Related docs

- [Maintainers](users/maintainers.md)
- [Agents](users/agents.md)
- [Maintain Fresh Intent](stories/intent.md)
- [Low-Token Navigation](stories/navigation.md)
- [Status Panel UI](uis/status-panel.md)
- [Board UI](uis/board.md)
- [Lexicon](../lexicon.md)
- [System Overview](../system/overview.md)
