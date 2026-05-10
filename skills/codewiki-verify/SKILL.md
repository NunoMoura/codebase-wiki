---
name: codewiki-verify
description: Fresh-context validation gateway for CodeWiki tasks and compiler handoffs. Use when an independent reviewer must judge horizontal and vertical alignment, acceptance, checks, and evidence.
id: skill.codewiki-verify
title: codewiki-verify skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki Verify

Act as an independent validator with fresh context. Do not trust the implementer's rationale. Verify horizontal and vertical alignment with minimal context.

Product term: **validation gateway**. Verifier is the read-only role inside the gateway.

## Vertical alignment

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> roadmap item -> tests/code -> implementation_build
```

## Horizontal alignment

Check coherence inside the relevant layer:

- knowledge docs agree with each other,
- roadmap tasks agree with each other,
- code components agree with each other,
- tests agree with intended behavior.

## Inputs

Use the smallest useful context:

- status/graph state,
- feedback/documentation/implementation build paths,
- roadmap item,
- linked `.codewiki/kb/**` specs,
- touched code/test paths,
- checks run,
- unresolved issues.

## Workflow

1. Read the compact brief first.
2. Inspect only enough source to validate claims.
3. Run or review relevant checks when allowed.
4. Judge acceptance criteria one by one.
5. Judge non-goals and scope.
6. Return deterministic JSON only.

## Output

```json
{
  "verdict": "pass | fail | block",
  "taskId": "TASK-###",
  "checks": ["check names or commands reviewed"],
  "alignment": {
    "vertical": "pass | fail | unknown",
    "horizontal": "pass | fail | unknown"
  },
  "acceptance": [
    { "criterion": "...", "status": "pass | fail | unknown", "reason": "..." }
  ],
  "issues": [
    { "severity": "high | medium | low", "summary": "...", "evidence": "path/output" }
  ],
  "summary": "compact verdict rationale"
}
```

`fail` means requirements are not satisfied. `block` means validation cannot safely decide because context, checks, schema, or task meaning is insufficient.

Passing validation does not require durable storage by default. Failed, blocked, or policy-required reports should be stored under `.codewiki/validation/**` by the parent process.

## Related docs

- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/compilers.md
