---
id: spec.system.v2-operating-model
title: CodeWiki v2 Operating Model
state: proposed
summary: Agreed v2 model for canonical truth, views, memory use, subagents, heartbeat, ThinkCode, and sanitation.
owners:
  - architecture
  - product
updated: "2026-05-01"
code_paths:
  - extensions/codewiki
  - scripts/rebuild_docs_meta.py
  - skills
---

# CodeWiki v2 Operating Model

## Core model

CodeWiki v2 keeps this separation:

```text
canonical = knowledge + roadmap tasks + evidence
views = optimized read models for agent/UI
agent writes canonical, consumes views
```

Canonical truth is durable project memory. Views are generated navigation and read models rebuilt from that truth. The status panel and agents should consume views first, then expand to linked canonical files only when needed.

## Target `.wiki` shape

```text
.wiki/
  config.json
  events.jsonl
  knowledge/
    lexicon.md
    product/users.md
    product/stories.md
    product/surfaces.md
    system/architecture.json
    system/components/*.md
    system/flows/*.md
  roadmap/tasks/TASK-###/task.json
  evidence/*.jsonl
  views/
    status.json
    graph.json
    drift.json
    product/brief.json
    system/architecture.json
    system/architecture.mmd
    roadmap/queue.json
    roadmap/tasks/TASK-###/context.json
    evidence/recent.json
```

`overview.md` files are optional navigation pages. They must not become large canonical dumps.

## Architecture graph and flows

`system/architecture.json` should be the canonical graph of components and information flows. Component docs explain nodes. Flow docs explain important cross-component paths. The Mermaid architecture file is generated as a view and rendered by the status panel.

## Memory policy

The context window is expensive RAM. The `.wiki` is persistent memory. A parent agent should keep only the current user intent, focused task, loaded view revisions, and small decisions in session context. Heavy context creation should happen through views, targeted canonical reads, subagents, or `think-code` programs.

## Subagents

Subagents should run context-heavy or bias-sensitive work in fresh sessions. Good subagent roles include verifier, researcher, planner, architecture reviewer, and view auditor. Subagents should normally return compact JSON to the parent; the parent decides which canonical writes to perform.

## Heartbeat

Heartbeat is a bounded autonomous loop. It reads status, rebuilds stale views, chooses inner-loop or outer-loop work, spawns subagents for heavy checks, writes canonical truth, rebuilds views, and stops on budget, risk, or ambiguity. Modes should include observe, maintain, and work.

## ThinkCode role

Views are persistent common context. ThinkCode is an ad hoc programmatic query and ETL executor. It should help build temporary context packets, filter large searches, validate architecture graphs, compute stale hashes, and stage safe edits under policy.

## Sanitation and git

Knowledge should stay fresh, views should stay current, and git should be the full historical recovery mechanism. CodeWiki should keep only compact semantic archives for closed tasks and release checkpoints. Old raw evidence and event history should not be part of default agent context.

Recommended boundaries:

- one coherent commit per closed task
- push after green checks and task closure when policy allows
- patch versions for small user-visible changes
- minor versions for roadmap sprint or schema/view-contract changes
- release checkpoints record version, git sha, closed task summaries, canonical digest, and view schema version
