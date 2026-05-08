---
id: spec.system.runtime
title: Runtime Policy
state: active
summary: Policy boundary for CodeWiki runtime access, compiler execution, validation gateways, and optional bounded tools.
owners:
  - architecture
updated: "2026-05-07"
---

# Runtime Policy

## Responsibility

The runtime policy keeps agent-facing CodeWiki operations small, inspectable, and bound to the repo-local `.codewiki/config.json` contract.

## Split of responsibility

- `.codewiki/config.json` declares readable paths, direct writable paths, generated read-only paths, byte caps, and runtime adapter metadata.
- CodeWiki owns domain semantics: knowledge, roadmap task packs, compiler builds, validation reports, and generated graph/index state.
- Pi owns the host runtime, project working directory, session state, package loading, and optional session storage.
- Optional bounded context tools such as ThinkCode may execute agent-written analysis programs when available.
- Native harness tools remain the fallback for free exploration when CodeWiki graph/context is insufficient.

CodeWiki should expose typed capabilities instead of asking runtimes to mutate `.codewiki/` internals directly. External tools may read project files when policy permits, but writes to CodeWiki-managed state should flow through CodeWiki transactions, task APIs, session APIs, build writers, or rebuild capabilities.

## Compiler execution model

Runtime orchestration follows the compiler model:

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build + task packs
    -> implementation compiler -> implementation_build
```

The main agent usually orchestrates feedback and documentation compilers. Separate worker sessions are optional. Validation gateways use a separate fresh read-only session when semantic judgment is required.

## Feedback escalation

The feedback compiler is both the top entry point and the escalation path. If documentation or implementation work uncovers ambiguity, unmapped user intent, contradictory requirements, or an unsafe decision, the agent returns to the feedback compiler instead of guessing.

Feedback compiler reads may include `.codewiki/kb/**`, roadmap state, graph state, and code. Writes happen only after the accepted `feedback_build` exists.

## Documentation execution

The documentation compiler consumes an accepted `feedback_build` and updates:

- `.codewiki/kb/**` knowledge,
- `.codewiki/roadmap/**` task packs,
- `.codewiki/builds/documentation/**` build artifacts.

It validates that knowledge, roadmap, and task packs are horizontally coherent and vertically aligned with the feedback build.

## Implementation execution

The implementation compiler consumes a task pack and produces tests, code changes, checks, and an `implementation_build`.

Tests live in code/test directories. Task packs describe acceptance and validation expectations; they do not contain test code.

When tests are created by agents, the implementation compiler may split into:

- `tester`: derives tests from the task pack before code changes.
- `builder`: changes code until tests and required checks pass.

This split is optional and should be used when it improves independence or reduces bias.

## Validation gateway

Use `validation gateway` as the product term. A verifier is a read-only role inside the gateway, not the whole concept.

A validation gateway accepts a profile, compact brief, policy budget, and linked context. It returns a validated verdict packet and never mutates canonical truth directly.

Initial profiles should include:

- `feedback-build` for accepted user-intent handoff.
- `documentation-build` for knowledge and roadmap/task-pack handoff.
- `implementation-build` for task-pack implementation handoff.
- `task-close` for closing a roadmap task.
- `drift-audit` for horizontal and vertical drift review.
- `graph-audit` for generated index graph alignment.
- `release-checkpoint` for version/checkpoint gates.
- `runtime-adapter` for Pi, CLI, MCP, Codex, Claude Code, ThinkCode, and other adapter seams.
- `skill-package` for packaged skill and workflow asset changes.

A gateway can use four layers:

1. Deterministic preflight validates schemas, required links, build presence, and profile-specific required fields.
2. Mechanical checks run or review allowed commands such as typecheck, lint, tests, smoke checks, and profile-specific scripts.
3. Semantic validation runs in a fresh read-only process or subagent and checks vertical alignment plus horizontal coherence.
4. Evidence/report handling stores failed, blocked, or policy-required validation reports and blocks handoff on `fail` or `block`.

Passing validation does not require durable report storage by default.

## Capability manifest

CodeWiki exposes semantic capabilities for runtimes that need programmatic access without bypassing `.codewiki/` semantics. The current gateway can print the manifest with:

```bash
node scripts/codewiki-gateway.mjs manifest [repo]
```

Capability classes:

- `codewiki.state` reads compact status, roadmap, session, graph, and task context.
- `codewiki.task` mutates canonical roadmap task truth and task evidence.
- `codewiki.session` records Pi session focus/notes linked to tasks.
- `codewiki.transaction` applies validated exact-text knowledge patches and append-only evidence writes.
- `codewiki.build` writes accepted compiler build artifacts.
- `codewiki.validation` records failed, blocked, or policy-kept validation reports.
- `codewiki.rebuild` regenerates graph/index state.

## History policy

Do not store raw event history by default. Git is the full history mechanism. Pi session storage and future agent harness session tools own execution transcripts. CodeWiki stores compact semantic artifacts only when they help future work: knowledge, roadmap task packs, compiler builds, validation reports, checkpoints, and compact task evidence.

## Transaction v1

Transactions are JSON objects with `version: 1`, a short `summary`, and an `ops` array. Supported direct ops are exact-text `patch` and `append_jsonl`.

```json
{
  "version": 1,
  "summary": "Update CodeWiki knowledge.",
  "ops": [
    {
      "kind": "patch",
      "path": ".codewiki/kb/system/overview.md",
      "oldText": "old exact text",
      "newText": "new exact text"
    },
    {
      "kind": "append_jsonl",
      "path": ".codewiki/evidence/runtime.jsonl",
      "value": { "summary": "Evidence entry" }
    }
  ]
}
```

## Related docs

- [System Overview](../overview.md)
- [Product](../../product/overview.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
