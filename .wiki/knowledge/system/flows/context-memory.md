---
id: spec.system.flows.context-memory
title: Context Memory Flow
state: proposed
summary: How CodeWiki chooses between session RAM, views, canonical knowledge, subagents, and optional bounded context tools.
owners:
  - architecture
updated: "2026-05-02"
code_paths:
  - extensions/codewiki/contracts.ts
  - skills
---

# Context Memory Flow

## Flow

```text
user prompt
  -> parent Pi agent session RAM
  -> tiny status view
  -> recommended task/product/system/drift views
  -> role seed pack and scoped graph slice
  -> optional bounded context tool for programmatic exploration over listed paths
  -> targeted canonical docs and code paths only when needed
  -> optional subagent for heavy or bias-sensitive work
  -> compact result back to parent
  -> canonical write
  -> view rebuild
```

## Rules

The context window is expensive RAM and should not become the default store for project truth. The parent agent keeps the current user intent, focused task, loaded view revisions, and small decisions. It should avoid loading whole wiki trees or raw historical logs.

Views are the default persistent read surface. They should provide cached routes and scoped graph slices, not large context dumps. Canonical files are expanded when a view points to them or when exact source is required.

The preferred access pattern is hybrid: a compact role seed pack gives the map, and optional bounded context tools provide a microscope for programmatic filtering, validation, and temporary context creation over the listed paths. ThinkCode is one compatible tool, not a CodeWiki requirement.

Subagents handle context-heavy verification, research, architecture review, and planning review in fresh sessions. They should consume the same views and seed packs instead of relying on ad hoc prompt assembly.

## Success signals

- The first read for most workflows is a tiny status view.
- Views include revisions, role-specific recommended next reads, scoped graph slices, and bounded exploration hints so unchanged or irrelevant context can be skipped.
- Subagents return compact JSON summaries instead of pushing large raw context into the parent session.
- Observability reports horizontal and vertical alignment facts without becoming a pass/fail gate; verification profiles consume those facts separately.
- Parent agents perform canonical writes only after reviewing compact results.

## Subagent JSON workers

Subagents are fresh-context workers, not canonical writers. Parent agent sends a compact `SubagentBrief` and receives a compact `SubagentResult`. Parent decides whether to mutate `.wiki` knowledge, roadmap tasks, or evidence.

Shared brief fields:

```json
{
  "role": "verifier | researcher | planner | architecture_reviewer | view_auditor",
  "taskId": "TASK-###",
  "question": "bounded question",
  "intent": "user or parent goal",
  "budget": { "targetTokens": 4000, "maxFiles": 12 },
  "inputs": {
    "views": [".wiki/views/status.json"],
    "spec_paths": [".wiki/knowledge/system/v2-operating-model.md"],
    "code_paths": ["extensions/codewiki/contracts.ts"],
    "evidence_paths": [],
    "checks": ["npm test"]
  },
  "constraints": ["read-only", "no canonical writes"]
}
```

Shared result fields:

```json
{
  "role": "verifier",
  "verdict": "pass | fail | block",
  "taskId": "TASK-###",
  "checks": ["checks run or reviewed"],
  "acceptance": [
    { "criterion": "...", "status": "pass | fail | unknown", "reason": "..." }
  ],
  "findings": ["compact facts"],
  "issues": [
    {
      "severity": "high | medium | low",
      "summary": "...",
      "evidence": "path or output"
    }
  ],
  "proposals": [
    {
      "kind": "none | knowledge_patch | task_delta | follow_up",
      "summary": "...",
      "paths": ["..."]
    }
  ],
  "rationale": "short explanation"
}
```

Role contracts:

- `verifier`: validates task acceptance, checks, non-goals, and evidence. It should consume a `verify` seed pack, acceptance/evidence matrix, and observability signals when available. Returns `pass`, `fail`, or `block`; no proposals unless follow-up is needed.
- `researcher`: answers a bounded claim/question with sources and uncertainty. Returns `pass` when evidence supports a finding, `block` when sources are insufficient, and proposals for knowledge patches or follow-up.
- `planner`: converts intent, drift, or research into candidate knowledge/task deltas. Returns proposal semantics; parent creates tasks.
- `architecture_reviewer`: inspects seams, ownership, and graph/doc/code alignment. Returns findings plus possible task deltas; parent chooses design direction.
- `view_auditor`: compares generated views against canonical docs/tasks/evidence and reports stale, missing, or noisy views. Returns `fail` for view-contract drift, `block` for insufficient canonical context.

## Related docs

- [CodeWiki v2 Operating Model](../v2-operating-model.md)
