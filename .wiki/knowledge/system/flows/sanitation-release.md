---
id: spec.system.flows.sanitation-release
title: Sanitation and Release Flow
state: proposed
summary: How CodeWiki keeps hot state small while using git for historical recovery.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - scripts/rebuild_docs_meta.py
---

# Sanitation and Release Flow

## Flow

```text
task work completes
  -> checks and evidence recorded
  -> task closes
  -> compact semantic closure remains hot or warm
  -> full details remain recoverable from git
  -> release checkpoint summarizes sprint/version state
  -> views rebuild from current canonical truth
```

## Rules

Knowledge should describe the current desired state, not accumulate old decisions forever. Views should optimize current navigation and avoid cold history. Git is the full historical recovery mechanism. CodeWiki archives should be compact semantic indexes, not duplicate raw git history.

Recommended boundaries:

- commit one coherent change per closed task when practical.
- push after green checks and task closure when policy allows.
- use patch versions for small user-visible changes.
- use minor versions for roadmap sprints or schema/view contract changes.
- create release checkpoints for version, git sha, closed task summaries, canonical digest, and view schema version.

## Success signals

- Open tasks and current views stay small.
- Closed work remains discoverable through compact summaries.
- Full historical details can be recovered from git commits, tags, and remote history.
- Heartbeat never pushes, versions, or archives unless policy and checks allow it.

## Related docs

- [CodeWiki v2 Operating Model](../v2-operating-model.md)
