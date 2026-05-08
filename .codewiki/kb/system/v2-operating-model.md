---
id: spec.system.v2-operating-model
title: CodeWiki v2 Operating Model
state: active
summary: Current model for the .codewiki root, compiler builds, validation gateways, graph-first context, subagents, runtime tools, and sanitation.
owners:
  - architecture
  - product
updated: "2026-05-07"
code_paths:
  - extensions/codewiki
  - skills
---

# CodeWiki v2 Operating Model

## Core model

CodeWiki v2 treats agent work as a series of compilers across abstraction layers.

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build + task packs
    -> implementation compiler -> implementation_build
```

Each compiler receives the smallest valid context from the layer above, validates alignment at its boundary, and produces a compact build artifact for the layer below. The artifacts are agent-first and token-efficient. They are not prose archives.

The durable project contract is rooted at `.codewiki/`:

```text
.codewiki/
  config.json
  kb/               # canonical knowledge base
  roadmap/          # canonical task packs and roadmap state
  builds/           # compiler outputs
    feedback/
    documentation/
    implementation/
  validation/       # fail/block/policy-kept validation reports
  index_graph.json  # generated graph-only primary read model
```

`.codewiki/kb/**` is the canonical knowledge base. It describes current intended product and system truth. It should not contain code artifacts, tests, raw logs, or generated context packs.


## Compiler responsibilities

### Feedback compiler

The feedback compiler turns user conversation into an accepted `feedback_build`.

It may read `.codewiki/kb/**`, roadmap state, and code when grounding an answer, but it should not write canonical knowledge until the feedback build is accepted. Its validation gateway checks that user intent, constraints, non-goals, risks, and blind spots are mapped.

A feedback build should answer:

- what the user wants now,
- which assumptions were validated,
- which ambiguities remain,
- which decisions were accepted,
- which lower-layer artifacts must change.

### Documentation compiler

The documentation compiler turns an accepted `feedback_build` into updated knowledge and roadmap/task packs.

It owns `.codewiki/kb/**` edits, roadmap alignment, and task pack creation. Its validation gateway checks horizontal and vertical alignment before work is handed to implementation.

A documentation build should answer:

- which knowledge changed,
- which roadmap tasks changed or were created,
- which task packs are ready for implementation,
- which requirements are intentionally deferred or out of scope.

### Implementation compiler

The implementation compiler turns task packs into tests, code, checks, and `implementation_build` evidence.

Tests belong in code/test directories, not inside `.codewiki/kb/**` or roadmap task folders. Task packs describe what must be validated; test files encode how the implementation validates it.

When tests are agent-created, the implementation compiler may split into two roles:

- `tester` derives or updates tests from the task pack before code changes.
- `builder` changes code until the tests and required checks pass.

This split reduces shared-context bias while keeping the task pack as the contract between documentation and implementation.

## Validation gateways

Use `validation gateway` as the product term. A verifier can be an implementation role inside a gateway, but verification is not the whole gate.

Each gateway validates one layer boundary:

```text
feedback validation: user intent -> feedback_build
documentation validation: feedback_build -> kb + roadmap/task packs
implementation validation: task pack -> tests/code -> implementation_build
```

Validation checks both vertical and horizontal alignment.

Vertical alignment:

```text
user intent
  -> feedback_build
  -> .codewiki/kb knowledge
  -> documentation_build
  -> roadmap task pack
  -> tests/code
  -> implementation_build
```

Horizontal alignment:

```text
knowledge docs agree with knowledge docs
roadmap tasks agree with roadmap tasks
code components agree with code components
tests agree with intended behavior
```

Passing validation does not need durable storage by default. Failed, blocked, or policy-required validation reports should be stored under `.codewiki/validation/**`.

Any compiler may escalate back to the feedback compiler when it finds ambiguity, missing user intent, or a requirement that cannot be resolved from existing knowledge.

## Graph-first read model

CodeWiki should avoid a large generated view zoo. The primary generated read model is `.codewiki/index_graph.json`.

The graph is generated from canonical inputs:

```text
.codewiki/kb/**
.codewiki/roadmap/**
.codewiki/builds/**
.codewiki/validation/**
code/test manifests
```

The graph maps alignment and routing edges across knowledge, builds, tasks, tests, code components, and validation reports. Small status or queue lenses may be derived from the graph for UI performance, but they are cached graph queries, not separate sources of truth.

The graph also exposes a reconciliation state machine. The reconciliation gateway/controller reads graph state and chooses the next existing loop:

```text
intent missing or proposed -> feedback
accepted feedback or code-to-doc drift -> documentation
open roadmap implementation delta -> implementation
no drift -> observe
```

This is flexible typed-layer reconciliation, not a strict one-way pipeline. Code/test changes can create upward drift that routes back to documentation or feedback when intent is unclear.

Agents should start with `codewiki_state` or the graph-backed status surface, then expand to exact files only when needed. Free exploration with native harness tools or ThinkCode remains the fallback when the graph cannot answer the question.

## Subagents and roles

Default topology:

```text
main agent: orchestration, feedback compiler, documentation compiler by default
validation gateway: separate fresh read-only session
tester: optional implementation worker that writes tests from task pack
builder: optional implementation worker that makes tests pass
```

Separate agents per compiler are optional, not the default. Artifact boundaries matter more than agent count. Use worker sessions when the task is large, bias-sensitive, or context-heavy.

## Runtime and history boundaries

CodeWiki should reduce agent-facing surfaces. Prefer a few semantic capabilities, graph-backed state, compiler builds, validation reports, and a strong programmatic fallback.

Do not store raw event history by default. Git is the full history mechanism. Pi session storage and future agent harness session tools own execution transcripts. CodeWiki stores compact semantic state: knowledge, roadmap task packs, builds, and validation reports when needed.

## Related docs

- [System Overview](overview.md)
- [Runtime Policy](runtime/overview.md)
- [Generated Graph View](components/views.md)
- [Task Loop Flow](flows/task-loop.md)
