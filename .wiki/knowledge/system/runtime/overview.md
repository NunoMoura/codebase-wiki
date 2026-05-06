---
id: spec.system.runtime
title: Runtime Policy
state: active
summary: Policy boundary for codewiki runtime access in codewiki.
owners:
  - architecture
updated: "2026-05-06"
---

# Runtime Policy

## Responsibility

The runtime policy keeps agent-facing wiki operations small, inspectable, and bound to the repo-local `.wiki/config.json` contract.

## Split of responsibility

- `.wiki/config.json` declares readable paths, direct writable paths, generated read-only paths, byte caps, and runtime adapter metadata.
- `scripts/codewiki-gateway.mjs` is the current adapter for compact reads and validated transaction application.
- Optional bounded context tools may execute agent-written analysis programs when available in Pi.
- Pi owns the host runtime, project working directory, session state, package loading, and any optional outer sandbox extension.
- CodeWiki owns domain semantics: views stay read-only, evidence is append-only, roadmap/task state goes through canonical mutation APIs, and views are rebuilt only when fresh views are explicitly requested or a rebuild command runs.

## Capability boundary

CodeWiki should expose its own typed capabilities instead of asking runtimes to mutate `.wiki` internals directly. External tools may read project files, including `.wiki/**` when policy permits, but writes to CodeWiki-managed state should flow through CodeWiki transactions or task APIs.

The desired composition is:

```text
Pi host runtime
  └─ optional Pi sandbox extension
      └─ optional bounded programmatic runtime
          └─ CodeWiki capability or transaction surface
```

This keeps CodeWiki responsible for meaning and validation while allowing optional runtime tools to specialize in bounded programmatic execution and staged filesystem operations.

## Task execution loop

CodeWiki task execution should progress automatically once a task is selected or resumed:

```text
load task → create context → implement → local verify → fresh verify → evidence → close/block/follow-up
```

Optional bounded context tools can create compact project context for token-heavy exploration when available, but CodeWiki must keep a fallback path through normal Pi tools and CodeWiki views. When ThinkCode is installed, CodeWiki may provide a bounded script plan for `think_code_run` that reads views, task shards, and graph cues and returns a compact packet. If it is not installed, agents use `codewiki_state`, `scripts/codewiki-gateway.mjs pack/tree/manifest`, and normal Pi read/search tools. Local verification handles mechanical feedback such as typecheck, tests, lint, and smoke scripts. Fresh verification is a separate read-only stage that checks alignment from a clean context before closure.

Task closure requires evidence: checks run, files touched, unresolved issues, and verifier verdict when policy requires it. If verification fails or blocks, CodeWiki should record evidence and create follow-up roadmap tasks or keep the current task open instead of silently closing it.

## Verification gateway

CodeWiki verification should be exposed as one internal capability router rather than a collection of ad hoc prompts. The gateway accepts a verification profile, a compact brief, and a policy budget. It returns a validated verdict packet and never mutates canonical truth directly.

Initial profiles should include:

- `task-close` for closing a roadmap task.
- `sprint-close` for checking the integration quality of a planned sprint before closing it.
- `roadmap-close` for checking that a roadmap has no active unmapped delta before a product review or new roadmap begins.
- `release-checkpoint` for version/checkpoint gates.
- `drift-audit` for horizontal and vertical drift review.
- `view-audit` for generated view alignment.
- `runtime-adapter` for Pi, CLI, MCP, Codex, Claude Code, ThinkCode, and other adapter seams.
- `skill-package` for packaged skill and workflow asset changes.

The gateway should run four layers in order:

1. Deterministic preflight validates schemas, required links, evidence presence, generated-view freshness, and profile-specific required fields.
2. Mechanical checks run or review allowed commands such as typecheck, lint, tests, smoke checks, and profile-specific scripts.
3. Semantic verification runs in a fresh read-only process or subagent and checks vertical alignment (`user intent → knowledge → roadmap → code/docs → evidence`) and horizontal coherence inside each layer.
4. Evidence gating appends the verifier packet through the parent process and blocks closure on `fail` or `block`.

## Fresh verifier process

When a task is explicitly closed through the task API, CodeWiki should call the verification gateway with the `task-close` profile unless project policy disables it. The semantic verifier runs in a separate process, session, or subagent with a fresh context window and read-only tools. It receives a compact brief containing the task, linked specs/code paths, acceptance criteria, non-goals, recent evidence, touched paths, and task context packet.

The verifier must return deterministic JSON with `pass`, `fail`, or `block`, and CodeWiki must parse and validate it against a strict schema before using it. The parent process appends that verifier result as task evidence. A non-pass verdict blocks closure. Manual verifier commands are allowed only as override/debug entrypoints; the normal inner loop should not depend on users invoking them.

## Capability manifest

CodeWiki exposes semantic capabilities for runtimes that need programmatic access without bypassing `.wiki` semantics. The current gateway can print the manifest with:

```bash
node scripts/codewiki-gateway.mjs manifest [repo]
```

Each capability entry has:

- `name` — stable capability id
- `class` — `read`, `semantic-write`, `session-write`, `validated-write`, or `derived-write`
- `summary` — short purpose
- `args_schema` — tool/schema or transaction contract name
- `result_schema` — result contract name
- `writes` — paths or external stores that may be mutated
- `audit` — fields that should be recorded for review

CodeWiki-owned capability classes:

- `codewiki.state` reads compact status, roadmap, session, and task context.
- `codewiki.task` mutates canonical roadmap task truth and task evidence.
- `codewiki.session` records Pi session focus/notes linked to tasks.
- `codewiki.transaction` applies validated exact-text knowledge patches and append-only evidence writes.
- `codewiki.rebuild` regenerates views.

External runtimes may read `.wiki/**` only when policy permits. Writes to views (`.wiki/graph.json`, `.wiki/lint.json`, `.wiki/roadmap-state.json`, `.wiki/status-state.json`, `.wiki/roadmap/index.json`, `.wiki/roadmap/state.json`, and task context shards today; `.wiki/views/**` in v2) remain out of scope except through the rebuild capability. Session mutators default to canonical writes without rebuilding views. Task mutators preserve fresh views by default for compatibility, but callers may set `refresh=false` when they need a minimal canonical write and can defer views to `codewiki_state refresh=true` or `codewiki.rebuild`. If `think-code` is not installed, CodeWiki continues to use its native tools, gateway `pack/tree/manifest`, generated views, and normal Pi read/search tools. ThinkCode staged writes are proposals until `think_code_apply` validates them, and CodeWiki-managed writes still flow through CodeWiki task/session/transaction/rebuild capabilities.

## Transaction v1

Transactions are JSON objects with `version: 1`, a short `summary`, and an `ops` array. Supported direct ops are exact-text `patch` and `append_jsonl`.

```json
{
  "version": 1,
  "summary": "Update wiki evidence.",
  "ops": [
    {
      "kind": "patch",
      "path": ".wiki/knowledge/system/overview.md",
      "oldText": "old exact text",
      "newText": "new exact text"
    },
    {
      "kind": "append_jsonl",
      "path": ".wiki/evidence/runtime.jsonl",
      "value": { "summary": "Evidence entry" }
    }
  ]
}
```

## Related docs

- [System Overview](../overview.md)
- [Product](../../product/overview.md)
