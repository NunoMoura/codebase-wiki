---
name: codewiki-documentation
description: Use when an accepted feedback_build must become canonical CodeWiki knowledge, when product/system KB specs need alignment, or when documentation changes must compile into a documentation_build before planning. Runs the documentation compiler with KB ownership, build, validation, and planning handoff rules.
id: skill.codewiki-documentation
title: CodeWiki documentation compiler skill
state: active
summary: Documentation-loop instructions for knowledge updates and documentation build handoffs.
owners: [maintainers]
updated: "2026-05-17"
---

# CodeWiki Documentation Compiler

Use this skill after feedback mode has produced an accepted `feedback_build`, or when a validation/audit result routes work back to knowledge alignment. The documentation loop updates durable `.codewiki/kb/**` truth and emits a `documentation_build` for planning.

For exact tool arguments and output fields, read `references/tools.md` when needed.

## Core rules

- Start from an accepted `feedback_build` or an explicit validation/audit route to documentation.
- Start with `codewiki_state`, then read the accepted build and owning knowledge files directly.
- Update only canonical knowledge needed to preserve accepted intent. Keep product intent in `.codewiki/kb/product/**` and technical architecture in `.codewiki/kb/system/**`.
- Do not create or refine roadmap tasks in documentation mode. If executable work is needed, capture planning questions and route to planning.
- Do not change source code or tests in documentation mode.
- Compile `codewiki_build kind="documentation"` after KB edits are complete and before planning handoff.
- Validate feedback-to-knowledge alignment before routing to planning.

## Workflow

1. **Load handoff context**
   - Run `codewiki_state` for repo health, reconciliation, and source refs.
   - Read the accepted `feedback_build` and any failed/blocked validation report that routed work here.
   - Restate accepted requirements, non-goals, assumptions, risks, and open questions.
   - If no accepted feedback/source route exists, return to feedback mode.

2. **Locate owning knowledge**
   - Use graph/build refs to find relevant `.codewiki/kb/**` docs.
   - Read owning docs before editing.
   - Identify the smallest set of product/system clauses that must change.
   - If no owning doc exists, create the smallest appropriate knowledge node and link it from the relevant overview only when needed.

3. **Coordinate edits**
   - For non-trivial edits, mark narrow artifact status with `codewiki_artifact_status` for affected KB paths and the documentation build path.
   - Keep artifact status scoped; it is runtime coordination, not durable truth.

4. **Update knowledge**
   - Patch `.codewiki/kb/**` with current intended truth, not a decision log.
   - Preserve existing frontmatter, ownership seams, curated links, and code path mappings where still correct.
   - Remove stale wording that conflicts with accepted feedback.
   - Keep historical rationale in the build, not in KB prose unless it is part of intended design.

5. **Compile documentation build**
   - Call `codewiki_build kind="documentation"` after KB edits.
   - Include `source_feedback_build`, `knowledge_changes`, `roadmap_changes` only for explicit non-routine roadmap notes, requirements, evidence mapping, assumptions, open questions, non-goals, risks, and planning questions.
   - The build is the handoff to planning; it should map requirement ids to changed knowledge refs without duplicating full future tasks.

6. **Validate documentation**
   - Run `codewiki_audit` for alignment/changed evidence when policy or risk requires it.
   - Use `codewiki_validation profile="documentation"` when validation is required, failed, blocked, or policy-required.
   - Validation checks vertical alignment from `feedback_build` to KB docs and horizontal coherence across edited knowledge.

7. **Route to planning**
   - If executable work remains, use `codewiki_session_handoff` with the `documentation_build` ref and expected output `planning_build`.
   - If the documentation change is knowledge-only and validation passes, record the outcome and stop.

## Stop conditions

Stop and route back to feedback when accepted intent is missing, a requirement conflicts with existing product/system truth, or user approval is needed for a semantic change not covered by the feedback build.

Stop and block when owning KB cannot be identified, required source refs cannot be read, or validation reports horizontal/vertical drift.

## Output

End documentation mode with one of:

- `documentation_build` path, changed KB paths, validation/audit refs, and planning handoff refs;
- knowledge-only validation result with no planning delta;
- blocking questions or drift findings routed back to feedback.
