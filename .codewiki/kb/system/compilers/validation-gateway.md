---
id: spec.system.compilers.validation-gateway
title: Validation Gateway
state: active
summary: Read-only alignment check at compiler handoffs. Judges vertical and horizontal coherence without mutating canonical truth.
owners:
  - architecture
updated: "2026-05-08"
code_paths:
  - skills/codewiki-verify/SKILL.md
  - extensions/codewiki/src/core/roadmap.ts
---

# Validation Gateway

## Responsibility

The validation gateway is a read-only check that judges alignment at compiler handoffs. It does not mutate canonical truth. It may recommend pass, fail, or block.

Use **validation gateway** as the product term. A verifier can be an implementation role inside a gateway.

The graph-backed **reconciliation gateway** is related but distinct: it is a controller that classifies graph state and routes to feedback, documentation, or implementation. It does not compile artifacts and does not become a fourth compiler.

## Handoff points

The gateway runs at each compiler boundary:

```text
feedback validation: user intent -> feedback_build
documentation validation: feedback_build -> .codewiki/kb + roadmap/task packs
implementation validation: task pack -> tests/code -> implementation_build
```

## Vertical alignment

```text
user intent
  -> feedback_build
  -> .codewiki/kb knowledge
  -> documentation_build
  -> roadmap task pack
  -> tests/code
  -> implementation_build
```

Each link must be traceable and coherent.

## Horizontal alignment

```text
knowledge docs agree with knowledge docs
roadmap tasks agree with roadmap tasks
code components agree with code components
tests agree with intended behavior
```

## Verdicts

| Verdict | Meaning |
|---------|---------|
| `pass` | Alignment holds. No blockers. |
| `fail` | Requirements not satisfied. Evidence of drift. |
| `block` | Cannot safely decide. Context, checks, or task meaning insufficient. |

## Storage

- Passing validation does not need durable storage by default.
- Failed, blocked, or policy-required reports persist under `.codewiki/validation/**`.

## Rules

- Read-only. Never mutates canonical truth.
- Runs in a fresh, bounded context.
- Returns strict JSON.
- Does not replace mechanical checks. Mechanical checks are an implementation concern.
- At task close, the gateway opinion is advisory. Parent agent decides closure based on evidence + acceptance.

## Subagent contract

Input: task pack, linked specs, code/test paths, checks run, implementation build, unresolved issues.

Output: strict JSON with `verdict`, `taskId`, `checks`, `alignment`, `acceptance`, `issues`, `rationale`.

## Related docs

- [Feedback Compiler](feedback.md)
- [Documentation Compiler](documentation.md)
- [Implementation Compiler](implementation.md)
- [CodeWiki v2 Operating Model](../v2-operating-model.md)
