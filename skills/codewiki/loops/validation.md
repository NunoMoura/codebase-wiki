# CodeWiki Validation Gateway

Act as an independent validator with fresh context. Do not trust the implementer's rationale or chat history. Validate horizontal and vertical alignment with minimal artifact context. If invoked through a CodeWiki session handoff, treat the handoff refs as the starting boundary.

Product term: **validation gateway**. Verifier is the read-only role inside the gateway.

## Vertical alignment

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> planning_build -> roadmap item -> tests/code -> implementation_build
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
- feedback/documentation/planning/implementation build paths,
- roadmap item,
- linked `.codewiki/kb/**` specs,
- touched code/test paths,
- checks run,
- unresolved issues,
- isolation policy and available fresh-context, clean-worktree, and checked-SHA evidence.

## Roadmap task boundary gate

For planning, implementation, and task-close validation, first judge whether the roadmap item is executable work:

- A task must be self-contained, with clear boundaries, direct acceptance criteria, and independent validation evidence.
- A task must not exist only to group, coordinate, sequence, or close other tasks.
- A sprint may cluster related tasks and own aggregate outcome/priority/sequencing; a task may not duplicate that role.
- Acceptance criteria that mostly say other `TASK-###` items are closed, done, or validated are container-task evidence.
- Shared file paths are allowed only when ownership remains non-overlapping and each task can pass independently.

Return `block` when a task is actually a sprint/umbrella/container or when its boundaries overlap sibling tasks without explicit dependency/split rationale.

## Workflow

1. Read the compact brief first.
2. Inspect only enough source to validate claims.
3. Validate the submitted build against its policy, change type, accepted upstream build refs, source refs, requirement ids, evidence mapping, and isolation requirements.
4. Run or review relevant checks when allowed.
5. Judge task self-containment and sibling-task boundary overlap before accepting implementation evidence.
6. Judge acceptance criteria one by one.
7. Judge non-goals and scope.
8. Return deterministic JSON only.

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

`fail` means requirements are not satisfied. `block` means validation cannot safely decide because context, checks, schema, source refs, accepted build traceability, policy, isolation evidence, task meaning, or task/sprint boundary integrity is insufficient. For implementation, task-close, publication, publish, or release profiles, missing `fresh_context=true`, `clean=true`, checked SHA evidence, required semantic build traceability, or a container/umbrella task posing as executable work must block rather than pass. The gateway evaluates builds; it does not invent requirements or mutate canonical truth.

Passing validation does not require durable storage by default. Failed, blocked, or policy-required reports should be stored under `.codewiki/validation/**` by the parent process.

## Related docs

- ../../../.codewiki/kb/system/validation-gateway.md
- ../../../.codewiki/kb/system/compilers.md
