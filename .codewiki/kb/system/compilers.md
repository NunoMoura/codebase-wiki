---
id: spec.system.compilers
title: Compilers
state: active
summary: Feedback, documentation, and implementation loops that create validated build briefs.
owners:
  - architecture
  - product
updated: "2026-05-09"
code_paths:
  - skills/codewiki-feedback/SKILL.md
  - skills/codewiki-plan/SKILL.md
  - skills/codewiki-task/SKILL.md
---

# Compilers

## Responsibility

CodeWiki uses three compilers for three loops:

```text
feedback loop -> validation gateway -> feedback_build
  -> documentation loop -> validation gateway -> documentation_build
    -> implementation loop -> validation gateway -> implementation_build
```

A compiler turns one layer of information into a validated brief for the next layer. The graph state machine can route work upward or downward depending on drift and missing intent. The agency controller can run bounded agency cycles through these loops, but it is not a fourth compiler.

## Feedback loop

The feedback loop captures user intent with a critical eye. It should not accept requests blindly. It helps the agent and user find the best solution to the stated intention or problem.

It should surface:

- tradeoffs,
- blind spots,
- pitfalls,
- simpler alternatives,
- conflicts with current product, system, architecture, or code truth,
- affected layers.

The feedback loop should present diff tables before canonical edits. Each row should show current state, proposed state, rationale, affected docs/code, risk, and a user action such as approve, edit, reject, or defer.

Accepted rows compile into a `feedback_build`.

## Documentation loop

The documentation loop consumes an accepted `feedback_build` and updates durable product/system knowledge. It also produces a `documentation_build` as the implementation-spec brief.

The documentation loop should:

- update the owning knowledge files,
- preserve product/system boundaries,
- create or update roadmap work items when implementation work is needed,
- avoid duplicating full requirements in the roadmap,
- validate horizontal and vertical alignment before handoff.

## Implementation loop

The implementation loop consumes a `documentation_build`, linked knowledge, and roadmap work item state. It creates or updates tests and code, runs checks, collects evidence, and produces an `implementation_build`.

For bias-sensitive or agent-created test work, it may split into:

- `tester`: derives tests from the implementation spec before code changes,
- `builder`: changes code until tests and required checks pass.

The split is optional.

## Gated agency

Gated agency may advance roadmap work automatically by invoking compiler steps inside explicit token, time, risk, validation, policy, and approval gates. The agency mechanism selects one bounded step, then stops, validates, or routes to the next loop.

Compilers should remain deterministic handoff producers. They should not own autonomous scheduling, budget policy, or publication approval.

## Propagation

A change can originate in any layer:

- product intent can propagate to system docs and code,
- system architecture changes can propagate to file structure and code,
- code changes can create documentation drift,
- validation failures can route back to implementation, documentation, or feedback,
- missing intent routes to feedback.

## Rules

- Builds carry loop handoff truth; they do not replace durable knowledge or executable code.
- Roadmap items track work state; they do not duplicate full requirements briefs.
- Tests live in code/test directories, not in knowledge or roadmap folders.
- Any compiler may escalate to feedback when intent is unclear.
- Handoffs require validation gateway approval or an explicit block/fail result.
- Automated compiler execution must run through gated agency controls, not through unbounded loops.

## Related docs

- [Builds](builds.md)
- [Validation Gateway](validation-gateway.md)
- [Agency Controller](agency.md)
