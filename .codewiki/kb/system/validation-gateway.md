---
id: spec.system.validation-gateway
title: Validation Gateway
state: active
summary: Pure build-validation gateway for horizontal and vertical alignment before handoff, closure, release, or publication.
owners:
  - architecture
updated: "2026-05-13"
code_paths:
  - skills/codewiki-verify/SKILL.md
  - .codewiki/validation
  - extensions/codewiki/src/application/builds.ts
---

# Validation Gateway

## Responsibility

The validation gateway has one job: validate a submitted cycle build against its policy, source refs, exit criteria, and evidence. It returns `pass`, `fail`, or `block`.

The gateway does not define requirements, write canonical truth, create plans, or compile handoffs. Compilers create builds. The gateway evaluates builds.

A verifier can be an implementation role inside the gateway, but validation gateway is the product term.

## Build validation contract

A gateway run should receive:

- the build path and build kind,
- the policy profile embedded in or selected for the build,
- requirement ids and exit criteria,
- source refs used by the compiler,
- evidence mapping supplied by the compiler,
- relevant graph/state routing context,
- any required mechanical checks or fresh-context isolation data.

The gateway should inspect only enough source truth to decide whether the build is valid. It may recommend routing after a fail or block, but the next compiler cycle owns the revised build.

## Gate points

Validation can run at:

- feedback build handoff,
- documentation build handoff,
- planning build handoff,
- implementation build handoff,
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
  -> planning_build
  -> roadmap work item
  -> tests/code
  -> implementation_build
```

Horizontal alignment checks coherence inside a layer:

```text
knowledge docs agree with knowledge docs
planning builds agree with roadmap tasks
roadmap items agree with roadmap items
code components agree with code components
tests agree with intended behavior
builds agree with their source layer and policy
```

Requirement ids and evidence mapping should make this trace explicit. The gateway should not rely on broad prose similarity when explicit refs are available.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `pass` | The build satisfies its policy and can be consumed by the next loop or publication step. |
| `fail` | A requirement, criterion, alignment claim, or evidence mapping is proven wrong or incomplete. |
| `block` | The gateway cannot safely decide because context, checks, policy, source refs, or intent is insufficient. |

A failed or blocked verdict should name the failed criteria or missing context. The producing loop then creates a superseding cycle build after revision.

## Persistence policy

Passing validation does not need a separate durable report by default when the accepted build records the validation result.

Persist validation reports when:

- verdict is `fail`,
- verdict is `block`,
- policy requires storage,
- release/audit mode requires storage,
- publication or remote update policy requires an explicit current record.

Persistent hot reports live under `.codewiki/validation/**`. Pass reports are hot only while active work, active publication, or audit policy needs them. After safe Git archival/publication, pass reports should be evicted from the working tree and recovered from Git only through explicit archive/restore/audit requests. Fail, block, and policy-kept reports remain hot until resolved or explicitly archived by policy.

## Rules

- The gateway validates builds; it does not mutate canonical truth.
- The gateway does not replace mechanical checks.
- The gateway does not invent requirements or plan implementation work.
- Semantic validation should run in a fresh, bounded context when independence matters.
- The gateway may recommend next routing: feedback, documentation, planning, implementation, validation, observe, or block.
- Gated agency must stop on fail/block verdicts or missing required approval.
- Commit, push, release, or remote updates require gateway/policy approval when configured.

## Isolation evidence

Implementation and task-close validation should be independently reproducible when the work changes code, tests, publication metadata, or release state. The preferred validation posture is:

- validator runs in a separate clean worktree from the builder,
- validator starts from artifacts rather than builder chat context,
- validation report records the exact Git commit SHA it checked,
- validation report records whether the worktree was clean,
- validation report records the validator role and any builder session or claim it intentionally did not reuse.

`sha` means a Git object id/hash. CodeWiki uses SHAs to make statements exact:

- `base_sha` is the commit where a work session started,
- `head_sha` is the builder or publisher result,
- `validated_sha` is the exact commit the validator checked,
- `published_sha` is the exact commit pushed or released.

Legacy reports can remain valid without these fields. New reports should include them when a fresh validator, publication gate, or audit needs independence evidence.

## Related docs

- [Builds](builds.md)
- [Compilers](compilers.md)
- [Roadmap](roadmap.md)
- [Agency Controller](agency.md)
