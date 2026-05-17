# CodeWiki Documentation

Run the documentation compiler after accepted feedback. Prefer the dedicated `codewiki-documentation` skill for full documentation-mode instructions.

```text
accepted feedback_build -> codewiki_state + direct KB reads -> knowledge edits -> documentation_build -> documentation validation -> planning handoff
```

## Rules

- `.codewiki/kb/**` is canonical intended knowledge.
- Start from an accepted `feedback_build` or an explicit validation/audit route to documentation.
- The feedback compiler owns unresolved user intent. If intent is ambiguous or a new semantic decision is needed, escalate to feedback instead of guessing.
- Documentation mode updates durable product/system knowledge only. It does not change source code, tests, or routine roadmap task shape.
- Routine roadmap mutation belongs to the planning compiler. Documentation builds may record planning questions and likely executable deltas, but should not duplicate full task briefs.
- Start documentation work from the accepted build in a fresh session or recorded context reset when this loop follows feedback.
- Use `codewiki_state` first as map and freshness/drift index. Then read the source build and owning KB files directly before edits.
- Mark narrow artifact statuses for non-trivial KB edits when parallel sessions may overlap.

## Workflow

1. **Confirm source build**
   - Read the accepted `feedback_build` and restate requirements, constraints, non-goals, risks, assumptions, and open questions.
   - If no accepted feedback/source route exists, return to feedback mode.

2. **Inspect current CodeWiki state**
   - Run `codewiki_state` first.
   - Use graph/build refs to locate relevant `.codewiki/kb/**` docs.
   - Surface drift between accepted feedback, current KB, roadmap, and code instead of silently choosing.

3. **Research if needed**
   - Use research only when external/library/source evidence is needed to write correct intended knowledge.
   - Route deeper CodeWiki research to `../playbooks/research.md`; use domain research skills when they are more appropriate.

4. **Update knowledge**
   - Patch owning `.codewiki/kb/**` specs with current intended truth.
   - Preserve product/system boundaries and stable ownership seams.
   - Avoid doc sprawl, raw history, or parallel ADR-style decision logs by default.
   - Keep planning detail out of KB unless it is intended architecture or product behavior.

5. **Prepare planning handoff**
   - Map approved requirement ids to changed knowledge files and clauses.
   - Record open planning questions, likely affected code/test areas, and whether executable roadmap work is needed.
   - State the required fresh-session or context-reset boundary for planning.

6. **Emit documentation build**
   - Call `codewiki_build kind="documentation"` after KB edits.
   - Include source feedback refs, changed knowledge paths, requirement-to-knowledge evidence, deferred requirements, assumptions, open questions, non-goals, risks, and planning handoff notes.

7. **Validate documentation**
   - Check vertical alignment: `feedback_build` -> KB changes -> `documentation_build`.
   - Check horizontal coherence between edited knowledge docs.
   - Use `codewiki_audit` and `codewiki_validation profile="documentation"` when policy or risk requires validation, or when verdict is fail/block/policy-required.

8. **Route next loop**
   - If executable work remains, hand off to the planning compiler with the `documentation_build` ref.
   - If the change is knowledge-only and validation passes, stop with the build and validation evidence.

## Verification

After documentation:

- `codewiki_state refresh=true` is green or any drift is explicitly routed.
- Changed knowledge is covered by a `documentation_build`.
- Documentation validation/audit evidence exists when required.
- Any executable delta is represented as a planning handoff, not a roadmap mutation performed in documentation mode.
- No unmapped knowledge/code drift was introduced.

## Related skill files

- ../../codewiki-documentation/SKILL.md
- ../../codewiki-documentation/references/tools.md
