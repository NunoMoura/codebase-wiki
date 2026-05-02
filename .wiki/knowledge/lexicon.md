---
id: spec.lexicon
title: Lexicon
state: active
summary: Shared CodeWiki vocabulary for agents, humans, tasks, and generated views.
owners:
  - product
  - architecture
updated: "2026-05-01"
---

# Lexicon

## Canonical truth

Durable project intent that agents may update through approved tools or exact wiki edits. In v2 this means knowledge docs, roadmap task records, evidence summaries, and config.

## View

A generated read model optimized for agent navigation and UI rendering. Views are consumed by agents but never hand-edited. They are rebuilt from canonical truth.

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

## Heartbeat

A bounded autonomous CodeWiki loop that reads views, chooses the next safe action, uses subagents when useful, writes canonical truth, rebuilds views, and stops on budget, risk, or ambiguity.

## ThinkCode

A generic project-scoped sandbox runtime for agent-written programs. In CodeWiki it is an ad hoc query, validation, and context-building executor, not the persistent memory layer.

## Surface

A way humans or AI users interact with CodeWiki, such as Pi tools, commands, status panel, TUI, CLI, MCP, package APIs, or future adapters.

## Sanitation

The policy that keeps hot wiki state small. Knowledge stays fresh, views stay current, closed history moves to compact semantic summaries, and full recovery relies on git.
