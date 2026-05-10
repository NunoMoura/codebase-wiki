---
id: spec.system.agency
title: Agency Controller
state: active
summary: System mechanism for bounded roadmap automation through agency cycles and explicit gates.
owners:
  - architecture
  - engineering
updated: "2026-05-09"
code_paths:
  - extensions/codewiki/src/application
  - extensions/codewiki/src/adapters/pi
---

# Agency Controller

## Responsibility

The agency controller is the system mechanism behind the product need for gated agency. It lets an agent advance roadmap work automatically while enforcing explicit token, time, risk, validation, policy, and approval gates.

The product concept is gated agency. The implementation mechanism is the agency controller running bounded agency cycles. An agency cycle observes state, selects safe work, runs one small step, checks gates, and stops or routes to the next loop.

## Inputs

The controller reads:

- graph state and recommended next actions,
- roadmap active work, blockers, and closure state,
- accepted builds and linked knowledge,
- validation requirements and policy gates,
- user-provided budgets such as token limit, time limit, cycle limit, write limit, and risk limit,
- harness capabilities exposed through adapters.

## Modes

| Mode | Responsibility |
| --- | --- |
| `observe` | Read graph and roadmap state, report next safe action, write nothing. |
| `maintain` | Refresh generated state or run safe audits inside a small write budget. |
| `work` | Advance one bounded roadmap/compiler step inside explicit gates. |

These modes are implementation controls, not product stories. Product docs should describe the user-visible gated agency experience.

## Stop conditions

The controller must stop when any gate fails:

- token, time, cycle, or write budget exhausted,
- risk exceeds the configured limit,
- user approval is required,
- intent is ambiguous,
- validation fails or blocks,
- checks fail,
- policy forbids the next action,
- destructive or publication action is requested without explicit approval.

## Routing

The controller does not replace the graph, compilers, roadmap, or validation gateway. It coordinates them:

```text
graph state -> roadmap focus -> compiler step -> validation gateway -> build/evidence -> next graph state
```

When intent is unclear, it routes to feedback. When knowledge must change, it routes to documentation. When code/tests must change, it routes to implementation. When evidence is ready, it routes to validation or closure.

## Invariants

- Agency is always gated; unbounded autonomous editing is not allowed.
- Agency cycles are bounded implementation steps, not a fourth compiler.
- The controller must not mutate generated graph state directly.
- The controller must not bypass validation gateway or policy decisions.
- Commit, push, release, and remote updates require explicit publication policy approval.

## Related docs

- [Roadmap](roadmap.md)
- [Graph](graph.md)
- [Validation Gateway](validation-gateway.md)
- [Compilers](compilers.md)
