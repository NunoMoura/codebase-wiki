---
id: spec.system.flows.context-memory
title: Context Memory Flow
state: active
summary: How CodeWiki chooses between session RAM, compiler builds, graph routes, canonical knowledge, subagents, and optional bounded context tools.
owners:
  - architecture
updated: "2026-05-07"
code_paths:
  - skills
---

# Context Memory Flow

## Flow

```text
user prompt
  -> parent Pi agent session RAM
  -> feedback compiler
  -> feedback_build
  -> graph-backed status or .codewiki/index_graph.json
  -> exact kb/roadmap/build/code paths
  -> optional bounded context tool for programmatic exploration
  -> optional subagent for validation, tester, builder, research, or architecture review
  -> compact result back to parent
  -> canonical write
  -> graph rebuild
```

## Rules

The context window is expensive RAM and should not become the default store for project truth. The parent agent keeps the current user intent, focused task, loaded graph/build revisions, and small decisions. It should avoid loading whole knowledge trees or raw historical logs.

Compiler builds are the handoff artifacts between abstraction layers. The graph is the primary generated read model. Canonical files are expanded when the graph or a build points to them, or when exact source is required.

The preferred access pattern is hybrid: a compact build or graph path gives the map, and optional bounded context tools provide a microscope for programmatic filtering, validation, and temporary context creation over listed paths. ThinkCode is one compatible tool, not a CodeWiki requirement.

Subagents handle context-heavy or bias-sensitive work in fresh sessions. They should consume the same builds, task packs, graph paths, and exact canonical files instead of relying on ad hoc prompt assembly.

## Success signals

- Feedback-loop work produces an accepted `feedback_build` before durable knowledge edits.
- Documentation work produces knowledge updates, roadmap/task-pack changes, and a `documentation_build` when useful.
- Implementation work produces tests/code/checks and an `implementation_build`.
- The first read for most workflows is `codewiki_state` or a graph-backed status surface.
- The graph routes to exact files and explains edge reasons instead of acting as a large context dump.
- Subagents return compact JSON summaries instead of pushing large raw context into the parent session.
- Validation gateways report horizontal and vertical alignment and block handoff on `fail` or `block`.
- Parent agents perform canonical writes only after reviewing compact results.

## Worker JSON roles

Fresh workers are not canonical writers. The parent agent sends a compact brief and receives a compact result. The parent decides whether to mutate `.codewiki/` knowledge, roadmap tasks, builds, or validation reports.

Shared brief fields:

```json
{
  "role": "validator | researcher | planner | architecture_reviewer | tester | builder | graph_auditor",
  "taskId": "TASK-###",
  "question": "bounded question",
  "intent": "user or parent goal",
  "budget": { "targetTokens": 4000, "maxFiles": 12 },
  "inputs": {
    "build_paths": [".codewiki/builds/feedback/2026-05-07-compiler-model.json"],
    "graph_paths": [".codewiki/index_graph.json"],
    "spec_paths": [".codewiki/kb/system/v2-operating-model.md"],
    "code_paths": ["extensions/codewiki/contracts.ts"],
    "checks": ["npm test"]
  },
  "constraints": ["read-only unless explicitly delegated", "no canonical writes"]
}
```

Shared result fields:

```json
{
  "role": "validator",
  "verdict": "pass | fail | block",
  "taskId": "TASK-###",
  "checks": ["checks run or reviewed"],
  "alignment": {
    "vertical": "pass | fail | unknown",
    "horizontal": "pass | fail | unknown"
  },
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
      "kind": "none | knowledge_patch | task_delta | follow_up | test_delta",
      "summary": "...",
      "paths": ["..."]
    }
  ],
  "rationale": "short explanation"
}
```

Role contracts:

- `validator`: validates a compiler handoff or task closure from fresh context. It checks vertical and horizontal alignment and returns `pass`, `fail`, or `block`.
- `researcher`: answers a bounded claim/question with sources and uncertainty. It proposes knowledge patches or follow-up when evidence changes intended truth.
- `planner`: converts intent, drift, or research into candidate knowledge/task deltas. The parent creates tasks.
- `architecture_reviewer`: inspects seams, ownership, and graph/doc/code alignment. It returns findings plus possible task deltas.
- `tester`: derives tests from a task pack before implementation.
- `builder`: changes code until task-pack tests and required checks pass.
- `graph_auditor`: compares `.codewiki/index_graph.json` and any cached lenses against canonical inputs.

## Related docs

- [CodeWiki v2 Operating Model](../v2-operating-model.md)
- [Generated Graph View](../components/views.md)
