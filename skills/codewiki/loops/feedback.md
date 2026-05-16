# CodeWiki Feedback

Run the feedback compiler. Accept user intent before canonical knowledge or code changes.

```text
user conversation -> inspect .codewiki/kb and code -> propose diff table + agent assessment -> user accepts -> feedback_build cycle -> validation gateway -> documentation compiler
```

## Rules

- May read `.codewiki/kb/**` and code for grounding. Does not write canonical knowledge until the build is accepted.
- Surfaces ambiguity, risk, blind spots, simpler alternatives, and blunt disagreement when the requested direction harms the project.
- Must present a compact diff table before asking the user to accept feedback. The table is the feedback-loop decision surface.
- Uses `ask_user` for decision handoffs. Never guesses user intent silently.
- Any compiler may escalate back here when it finds ambiguous or missing intent.
- Start feedback work from a fresh session or a recorded context reset when it follows another compiler loop.

## Workflow

1. **Listen to user intent**
   - Restate what you understood.
   - Surface explicit and implicit requirements.

2. **Ground in current state**
   - Read `codewiki_state` first.
   - Expand `.codewiki/kb/**` and code only when needed to ground an answer.
   - Surface drift between knowledge and code instead of choosing silently.

3. **Propose feedback build**
   - Present a markdown diff table before acceptance with these columns: `Current state`, `Desired state`, `Rationale`, `Affected layers`, `Risk`, `User action`.
   - Below the table, provide a first-principles agent assessment: what is sound, what is risky, where intent is unclear, which simpler alternatives exist, and where you disagree.
   - Keep rows high-signal and decision-oriented. Prefer 3-7 rows; split unrelated decisions into separate feedback handoffs.
   - Capture accepted decisions, assumptions, open questions, non-goals, risks, and requirement ids where useful.
   - Map which knowledge, planning, roadmap, build, validation, or code artifacts may need to change.
   - Note likely scoped change claims when parallel-session overlap risk is visible.
   - Ask user to accept before documentation compiler runs.

4. **Handoff**
   - After acceptance, create or confirm the accepted `feedback_build` cycle and route it through validation or policy to the documentation compiler (`loops/documentation.md`). The documentation compiler should start from the build ref in a fresh session or recorded context reset, not from feedback-loop chat memory.
   - If a later gateway verdict fails or blocks the build, create a superseding feedback cycle instead of mutating downstream layers silently.

## Compiler routing

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build
    -> planning compiler -> planning_build + roadmap work items
      -> implementation compiler -> implementation_build
```

The feedback compiler is always reachable as escalation.

## Related docs

- ../../../.codewiki/kb/system/compilers.md
- ../../../.codewiki/kb/system/validation-gateway.md
- ../../../.codewiki/kb/system/builds.md
