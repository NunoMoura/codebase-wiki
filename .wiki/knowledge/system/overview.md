---
id: spec.system.overview
title: System Overview
state: active
summary: Main runtime areas and ownership boundaries for codewiki.
owners:
  - architecture
updated: "2026-05-01"
code_paths:
  - extensions/codewiki
  - scripts/rebuild_docs_meta.py
  - skills
---

# System Overview

## Main boundaries

CodeWiki has one core responsibility: maintain the repository-local `.wiki` contract and expose it through Pi-native workflows.

- **Knowledge and roadmap semantics** own product specs, system specs, client surfaces, tasks, evidence, generated graph/state, and rebuild rules.
- **Pi package and extension surface** owns commands, status panels, session integration, packaged skills, bootstrap templates, smoke coverage, and resource discovery.
- **Runtime gateway boundary** owns CodeWiki-specific transactions, verifier orchestration, and capability descriptors, but delegates sandboxed execution to `think-code` or Pi's active runtime tools.

## Projection firewall

CodeWiki separates durable intent from generated read models so normal agent work stays token-efficient and drift-resistant.

Canonical truth that agents and semantic tools may mutate:

- `.wiki/config.json` for repo-local contract and runtime policy.
- `.wiki/knowledge/**/*.md` for product, client, and system intent.
- `.wiki/roadmap.json` plus per-task records for planned delta.
- `.wiki/events.jsonl`, `.wiki/roadmap-events.jsonl`, and evidence JSONL files for append-only history.

Generated projections that are tool-owned caches:

- `.wiki/graph.json`
- `.wiki/lint.json`
- `.wiki/roadmap-state.json`
- `.wiki/status-state.json`
- `.wiki/roadmap/index.json`
- `.wiki/roadmap/state.json`
- `.wiki/roadmap/tasks/*/context.json`

Agents should not hand-edit generated projections. Mutation tools should keep canonical writes separate from projection rebuilds. Session updates write canonical state without rebuilding projections; task updates can use `refresh=false` for the same minimal-write path when current read models are not needed immediately. `codewiki_state refresh=true` or the rebuild capability refreshes generated views on demand.

## Ownership seams

- [Extensions / Codewiki](extensions/codewiki/overview.md) owns the Pi extension surface under `extensions/codewiki`.
- [Runtime Policy](runtime/overview.md) owns the transaction boundary for compact reads and validated `.wiki` writes.

CodeWiki should not implement a general sandbox or duplicate Pi observability/eval packages. It should define what operations are meaningful for `.wiki` and let Pi-native runtimes execute them safely.

## Architecture organization rule

System docs mirror meaningful project hierarchy, not arbitrary doc categories.

- one folder per real boundary when needed
- one canonical `overview.md` per boundary
- local decisions live inside owning spec, not in a global ADR bucket

## Architecture review loop

Architecture review is a planning input, not an automatic refactor pass. Reviews should look for real friction in module depth, seams, adapters, locality, leverage, testability, and code/spec ownership. Findings become one of three things:

- a clarification to owning `.wiki/knowledge` specs,
- a roadmap task with acceptance criteria and verification,
- an explicit non-goal or deferred decision.

The review should present friction candidates before proposing final interfaces so humans can pick which design branch matters.

## Brownfield mapping rule

For existing repos, setup should infer first-pass ownership specs from repo-relative boundaries before humans refine the language and invariants.

## Related docs

- [Product](../product/overview.md)
- [Clients Overview](../clients/overview.md)
