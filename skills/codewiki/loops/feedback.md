# CodeWiki Feedback

Run the feedback compiler before canonical knowledge, roadmap, or code changes when user intent needs semantic approval. Prefer the dedicated `codewiki-feedback` skill for full feedback-mode instructions.

```text
user conversation -> codewiki_state + focused grounding -> codewiki_diff_table -> user accepts rows -> feedback_build -> optional feedback validation -> documentation compiler
```

## Rules

- May read `.codewiki/kb/**`, roadmap/build refs, and code for grounding. Does not write canonical knowledge or code.
- Surfaces ambiguity, risk, blind spots, simpler alternatives, and blunt disagreement when the requested direction harms the project.
- Must use `codewiki_diff_table` for semantic change proposals before asking the user to accept feedback. A chat-only table is not durable feedback-loop evidence.
- Never guesses user intent silently. Ask in chat, then record decisions with `codewiki_diff_table`; do not invent a user-decision tool.
- Any compiler may escalate back here when it finds ambiguous or missing intent.
- Start feedback work from a fresh session or a recorded context reset when it follows another compiler loop.

## Workflow

1. **Listen to user intent**
   - Restate what you understood.
   - Surface explicit and implicit requirements.
   - If no semantic delta exists, answer normally and do not create a diff table or build.

2. **Ground in current state**
   - Read `codewiki_state` first.
   - Expand `.codewiki/kb/**`, roadmap/build refs, and code only when needed to ground a decision.
   - Surface drift between knowledge and code instead of choosing silently.

3. **Propose semantic diff rows**
   - Call `codewiki_diff_table action="propose"` with rows containing `Current state`, `Desired state`, `Rationale`, `Affected layers`, `Risk`, and `User action`.
   - Present a compact row summary and first-principles assessment in chat: what is sound, what is risky, what is unclear, simpler alternatives, and any disagreement.
   - Keep rows high-signal and decision-oriented. Prefer 3-7 rows; split unrelated decisions into separate feedback handoffs.

4. **Record user decisions**
   - Call `codewiki_diff_table action="accept"` for each explicitly accepted row.
   - Call `reject`, `defer`, `alternative`, or `revise` for non-accepted or changed rows.
   - Do not proceed to a build until at least one row is accepted.

5. **Compile feedback build**
   - Create the accepted `feedback_build` with `codewiki_build kind="feedback"`.
   - Include accepted row ids, diff table rows, assumptions, open questions, non-goals, risks, requirement ids, evidence mapping, and likely lower-layer deltas.
   - Map which knowledge, planning, roadmap, build, validation, or code artifacts may need to change.

6. **Validate or hand off**
   - Run audit/validation when policy or risk requires it.
   - Route accepted feedback to the documentation compiler (`loops/documentation.md`) from the build ref in a fresh session or recorded context reset.
   - If a later gateway verdict fails or blocks the build, create a superseding feedback cycle instead of mutating downstream layers silently.

## Compiler routing

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build
    -> planning compiler -> planning_build + roadmap work items
      -> implementation compiler -> implementation_build
```

The feedback compiler is always reachable as escalation.

## Related skill files

- ../../codewiki-feedback/SKILL.md
- ../../codewiki-feedback/references/tools.md
