---
id: spec.system.flows.context-memory
title: Context Memory Flow
state: proposed
summary: How CodeWiki chooses between session RAM, views, canonical knowledge, subagents, and optional bounded context tools.
owners:
  - architecture
updated: "2026-05-01"
---

# Context Memory Flow

## Flow

```text
user prompt
  -> parent Pi agent session RAM
  -> tiny status view
  -> recommended task/product/system/drift views
  -> targeted canonical docs and code paths only when needed
  -> optional subagent or bounded context tool for heavy context work
  -> compact result back to parent
  -> canonical write
  -> view rebuild
```

## Rules

The context window is expensive RAM and should not become the default store for project truth. The parent agent keeps the current user intent, focused task, loaded view revisions, and small decisions. It should avoid loading whole wiki trees or raw historical logs.

Views are the default persistent read surface. Canonical files are expanded when a view points to them or when exact source is required. Subagents handle context-heavy verification, research, architecture review, and planning review in fresh sessions. Optional bounded context tools can handle programmatic filtering, validation, and temporary context creation. ThinkCode is one compatible tool, not a CodeWiki requirement.

## Success signals

- The first read for most workflows is a tiny status view.
- Views include revisions and recommended next reads so unchanged context can be skipped.
- Subagents return compact JSON summaries instead of pushing large raw context into the parent session.
- Parent agents perform canonical writes only after reviewing compact results.
