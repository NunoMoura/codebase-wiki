---
name: codewiki-feedback
description: Feedback compiler for CodeWiki. Use when user intent is ambiguous, when requirements need grounding before documentation, or when any compiler escalates unresolved intent.
id: skill.codewiki-feedback
title: codewiki-feedback skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki Feedback

Run the feedback compiler. Accept user intent before canonical knowledge or code changes.

```text
user conversation -> inspect .codewiki/kb and code -> propose feedback_build -> user accepts -> handoff to documentation compiler
```

## Rules

- May read `.codewiki/kb/**` and code for grounding. Does not write canonical knowledge until the build is accepted.
- Surfaces ambiguity, risk, and blind spots.
- Uses `ask_user` for decision handoffs. Never guesses user intent silently.
- Any compiler may escalate back here when it finds ambiguous or missing intent.

## Workflow

1. **Listen to user intent**
   - Restate what you understood.
   - Surface explicit and implicit requirements.

2. **Ground in current state**
   - Read `codewiki_state` first.
   - Expand `.codewiki/kb/**` and code only when needed to ground an answer.
   - Surface drift between knowledge and code instead of choosing silently.

3. **Propose feedback build**
   - Capture accepted decisions, assumptions, open questions, non-goals, risks.
   - Map which knowledge or code artifacts may need to change.
   - Ask user to accept before documentation compiler runs.

4. **Handoff**
   - After acceptance, route to documentation compiler (`codewiki-plan`).
   - If the feedback loop is small (single decision), the main agent may skip a formal build and proceed directly.

## Compiler routing

```text
feedback compiler -> feedback_build
  -> documentation compiler -> documentation_build + roadmap work items
    -> implementation compiler -> implementation_build
```

The feedback compiler is always reachable as escalation.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
