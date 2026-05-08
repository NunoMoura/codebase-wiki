---
id: spec.system.compilers.feedback
title: Feedback Compiler
state: active
summary: Turns user conversation into an accepted feedback_build before any canonical writes.
owners:
  - product
  - architecture
updated: "2026-05-08"
code_paths:
  - skills/codewiki/SKILL.md
  - skills/codewiki-feedback/SKILL.md
---

# Feedback Compiler

## Responsibility

The feedback compiler translates user intent into an accepted `feedback_build`. It grounds requirements in current knowledge and code without mutating canonical truth until the build is accepted.

## Flow

```text
user conversation
  -> inspect .codewiki/kb and code for grounding
  -> propose feedback_build
  -> user accepts
  -> handoff to documentation compiler
```

## Build artifact

A `feedback_build` lives under `.codewiki/builds/feedback/`. It is a transient handoff payload, not durable truth. Create it with `codewiki_build` after the user accepts feedback-loop decisions.

It answers:

- What the user wants now.
- Which assumptions were validated.
- Which ambiguities remain.
- Which decisions were accepted.
- Which lower-layer artifacts must change.
- Which lifecycle state and TTL apply.

Lifecycle:

```text
proposed -> accepted -> applied -> validated -> archived -> purged
```

Purge only after the downstream layer has absorbed the build facts and the validation gateway confirms alignment.

## Rules

- May read `.codewiki/kb/**` and code for grounding. Does not write canonical knowledge until the build is accepted.
- Surfaces ambiguity, risk, and blind spots before proposing implementation.
- Any compiler may escalate back to feedback when it finds missing intent or unsolvable ambiguity.
- Uses `ask_user` for decision handoffs. Does not guess user intent silently.

## Validation gateway

The feedback validation gateway checks:

- User intent is captured in the build.
- Constraints and non-goals are explicit.
- Open questions are acknowledged.
- Lower-layer delta is scoped.

A passing feedback build is handed to the documentation compiler.

## Escalation target

The feedback compiler is always reachable. If any compiler finds ambiguity, it escalates here.

## Related docs

- [CodeWiki v2 Operating Model](../v2-operating-model.md)
- [Documentation Compiler](documentation.md)
- [Generated Graph View](../components/views.md)
