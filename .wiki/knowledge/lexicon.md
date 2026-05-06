---
id: spec.lexicon
title: Lexicon
state: active
summary: Shared CodeWiki vocabulary for agents, humans, tasks, and generated views.
owners:
  - product
  - architecture
updated: "2026-05-06"
---

# Lexicon

## Canonical truth

Durable project intent that agents may update through approved tools or exact wiki edits. In v2 this means knowledge docs, roadmap task records, evidence summaries, and config.

## View

A generated read model optimized for agent navigation, verification, and UI rendering. Views are consumed by agents but never hand-edited. They are rebuilt from canonical truth.

## Context compiler

The view-generation role that compiles canonical knowledge, roadmap tasks, evidence, graph state, and lint state into compact routing artifacts for agents. A context compiler does not create new truth; it creates deterministic routes to the smallest useful context.

## Role seed pack

A compact generated context packet for a specific role such as `grill`, `plan`, `build`, or `verify`. It contains routing metadata, reasons, revisions, alignment signals, recommended next reads, and small decisive excerpts when useful. It should not inline broad docs, broad code, or old task history.

## Graph slice

A scoped generated subset of the knowledge graph for one task, sprint, roadmap question, or verification profile. A graph slice groups nodes into `core`, `supporting`, `watch`, and `excluded` tiers and records why each node was selected.

## Observability signal

A non-gating fact about horizontal or vertical alignment, freshness, bloat, missing links, or stale context. Observability signals inform agents and verification gateways, but they do not themselves close or block work.

## Canonical/view boundary

The rule that durable changes flow into canonical truth first, then tools rebuild views. Views must not become hidden sources of truth.

## Knowledge

Fresh, current project truth under `.wiki/knowledge/**`. Knowledge should describe the intended product and system as they should be understood now, not as a historical log.

## Roadmap task

An atomic tracked delta from current reality to intended knowledge. Tasks carry outcome, acceptance, non-goals, verification, linked specs, linked code, and evidence.

## Evidence

Compact proof or support for a claim. Research evidence supports knowledge and planning. Execution evidence supports task progress and closure.

## Context window

The active Pi agent session memory. It is volatile RAM and expensive because it is reloaded with each prompt in the session.

## Subagent

A fresh Pi agent invocation with a clean context window used for bounded work such as verification, research, planning review, or architecture review.

## Verification gateway

A CodeWiki capability router that runs deterministic preflight, allowed mechanical checks, fresh-context semantic verification, and evidence gating for profiles such as task close, sprint close, release checkpoint, drift audit, view audit, runtime adapter, and skill package changes.

## Verifier

A read-only fresh process, session, or subagent that returns a deterministic `pass`, `fail`, or `block` verdict. The verifier does not mutate canonical truth; the parent process records evidence and lifecycle changes.

## Heartbeat

A bounded autonomous CodeWiki loop that reads views, chooses the next safe action, uses subagents when useful, writes canonical truth, rebuilds views, and stops on budget, risk, or ambiguity.

## ThinkCode

An optional project-scoped sandbox runtime for agent-written programs. CodeWiki may interoperate with ThinkCode when installed, but CodeWiki does not require it and should remain usable with other Pi stacks.

## Surface

A way humans or AI users interact with CodeWiki, such as Pi tools, commands, status panel, TUI, CLI, MCP, package APIs, or future adapters.

## Sanitation

The policy that keeps hot wiki state small. Knowledge stays fresh, views stay current, closed history moves to compact semantic summaries, and full recovery relies on git.

## Related docs

- [Product](product/overview.md)
- [System Overview](system/overview.md)
- [V2 Operating Model](system/v2-operating-model.md)
