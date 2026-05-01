---
id: spec.system.runtime
title: Runtime Policy
state: active
summary: Policy boundary for codewiki runtime access in codewiki.
owners:
  - architecture
updated: "2026-04-29"
---

# Runtime Policy

## Responsibility

The runtime policy keeps agent-facing wiki operations small, inspectable, and bound to the repo-local `.wiki/config.json` contract.

## Split of responsibility

- `.wiki/config.json` declares readable paths, direct writable paths, generated read-only paths, byte caps, and runtime adapter metadata.
- `scripts/codewiki-gateway.mjs` is the current adapter for compact reads and validated transaction application.
- `think-code` should be the preferred generic executor for agent-written analysis programs when it is available in Pi.
- Pi owns the host runtime, project working directory, session state, package loading, and any optional outer sandbox extension.
- CodeWiki owns domain semantics: generated files stay read-only, evidence is append-only, roadmap/task state goes through canonical mutation APIs, and generated state is rebuilt after accepted writes.

## Capability boundary

CodeWiki should expose its own typed capabilities instead of asking runtimes to mutate `.wiki` internals directly. A `think-code` script may read project files, including `.wiki/**` when policy permits, but writes to CodeWiki-managed state should flow through CodeWiki transactions or task APIs.

The desired composition is:

```text
Pi host runtime
  └─ optional Pi sandbox extension
      └─ think-code gated programmatic runtime
          └─ CodeWiki capability or transaction surface
```

This keeps CodeWiki responsible for meaning and validation while allowing `think-code` to specialize in bounded programmatic execution and staged filesystem operations.

## Task execution loop

CodeWiki task execution should progress automatically once a task is selected or resumed:

```text
load task → create context → implement → local verify → fresh verify → evidence → close/block/follow-up
```

`think-code` is the preferred way to create compact project context for token-heavy exploration when it is available, but CodeWiki must keep a fallback path through normal Pi tools and CodeWiki state packets. Local verification handles mechanical feedback such as typecheck, tests, lint, and smoke scripts. Fresh verification is a separate read-only stage that checks alignment from a clean context before closure.

Task closure requires evidence: checks run, files touched, unresolved issues, and verifier verdict when policy requires it. If verification fails or blocks, CodeWiki should record evidence and create follow-up roadmap tasks or keep the current task open instead of silently closing it.

## Fresh verifier subprocess

When a task is explicitly closed through the task API, CodeWiki should run an automatic fresh verifier unless project policy disables it. The verifier runs in a separate `pi --mode json --no-session` subprocess with read-only tools (`read`, `grep`, `find`, `ls`) and receives a compact brief containing the task, linked specs/code paths, acceptance criteria, non-goals, and task context packet.

The verifier must return deterministic JSON with `pass`, `fail`, or `block`. CodeWiki appends that verifier result as task evidence. A non-pass verdict blocks closure. Manual verifier commands are allowed only as override/debug entrypoints; the normal inner loop should not depend on users invoking them.

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
- `codewiki.rebuild` regenerates derived state files.

External runtimes may read `.wiki/**` only when policy permits. Writes to generated state (`.wiki/graph.json`, `.wiki/lint.json`, `.wiki/roadmap-state.json`, `.wiki/status-state.json`, task context shards) remain out of scope except through the rebuild capability. If `think-code` is not installed, CodeWiki continues to use its native tools, gateway `pack/tree/manifest`, and normal Pi read/search tools.

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
