---
id: spec.product
title: Product
state: active
summary: Product intent and navigation for CodeWiki's users, stories, and surfaces.
owners:
  - product
updated: "2026-05-01"
---

# Product

CodeWiki exists to keep repository intent fresh, explicit, and actionable for Pi coding agents and humans. It turns user intent, product decisions, system structure, roadmap tasks, and evidence into a repo-local memory that agents can maintain and consume efficiently.

The product model is split into focused knowledge files instead of one large overview:

- [Users](users.md) defines who CodeWiki serves.
- [Stories](stories.md) defines the jobs and outcomes CodeWiki must support.
- [Surfaces](surfaces.md) defines the human and AI access surfaces.
- [Lexicon](../lexicon.md) defines shared project vocabulary.

## Product boundaries

CodeWiki owns the `.wiki` contract, canonical knowledge, roadmap tasks, evidence, generated views, and Pi-native workflows around them. It should not become a general-purpose sandbox, telemetry stack, evaluation framework, or monolithic runtime.

Programmatic execution belongs to runtimes such as `think-code`. CodeWiki should expose semantic capabilities and views that those runtimes can use without bypassing wiki rules.

## Success signals

- User intent is captured before implementation expands.
- Product stories map to roadmap tasks and system components.
- Agents consume compact views instead of rereading the entire wiki.
- Knowledge remains fresh while historical recovery relies on git and compact summaries.
- Pi sessions can resume work through roadmap tasks and generated task context views.
