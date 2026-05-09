---
id: spec.system.validation-gateway
title: Validation Gateway
state: active
summary: Loop-exit gateway that checks vertical and horizontal alignment before handoff, closure, release, or publication.
owners:
  - architecture
updated: "2026-05-09"
code_paths:
  - skills/codewiki-verify/SKILL.md
  - .codewiki/validation
---

# Validation Gateway

## Responsibility

The validation gateway decides whether a loop can end and whether the next loop can consume the produced build. It is read-only with respect to canonical truth.

A verifier can be an implementation role inside the gateway, but validation gateway is the product term.

## Gate points

Validation can run at:

- feedback loop exit,
- documentation loop exit,
- implementation loop exit,
- roadmap work closure,
- gated agency cycle boundaries,
- graph/drift audits,
- release checkpoints,
- commit/push/publication readiness,
- adapter/API boundary changes.

## Alignment checks

Vertical alignment checks traceability across layers:

```text
user intent
  -> feedback_build
  -> product/system knowledge
  -> documentation_build
  -> roadmap work item
  -> tests/code
  -> implementation_build
```

Horizontal alignment checks coherence inside a layer:

```text
knowledge docs agree with knowledge docs
roadmap items agree with roadmap items
code components agree with code components
tests agree with intended behavior
builds agree with their source layer
```

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `pass` | Alignment holds and no blocker remains. |
| `fail` | Requirement is not satisfied or drift is proven. |
| `block` | The gateway cannot safely decide because context, checks, policy, or intent is insufficient. |

## Persistence policy

Passing validation does not need a separate durable report by default when the accepted build records the validation result.

Persist validation reports when:

- verdict is `fail`,
- verdict is `block`,
- policy requires storage,
- release/audit mode requires storage,
- publication or remote update policy requires an explicit record.

Persistent reports live under `.codewiki/validation/**`.

## Rules

- The gateway does not mutate canonical truth.
- The gateway does not replace mechanical checks.
- Semantic validation should run in a fresh, bounded context when independence matters.
- The gateway may recommend next routing: feedback, documentation, implementation, validation, observe, or block.
- Gated agency must stop on fail/block verdicts or missing required approval.
- Commit, push, release, or remote updates require gateway/policy approval when configured.
