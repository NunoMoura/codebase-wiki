# CodeWiki Validation Gateway

Run the validation gateway as an independent no-mutation reviewer. Prefer the dedicated `codewiki-validation` skill for full validation-mode instructions.

```text
submitted build/source refs + task/context + audits/proof
  -> fresh validator context when required
  -> codewiki_state + direct source reads
  -> codewiki_audit evidence
  -> vertical/horizontal/task-boundary/isolation checks
  -> codewiki_validation pass|fail|block report when required
```

Product term: **validation gateway**. Verifier is the read-only role inside the gateway.

## Rules

- Start from artifacts, not builder chat memory.
- Validate one profile and one submitted source/build at a time.
- Use `codewiki_state` as a map, then read canonical build/task/KB/code/test refs directly.
- Use graph state for routing/freshness only; canonical files and content proof decide.
- Use `codewiki_audit` for required deterministic evidence before a pass verdict.
- Use `codewiki_validation` for policy-required reports, fail/block verdicts, task-close/publication proof, or explicit validator handoffs.
- Do not compile builds, create semantic diffs, change knowledge, create/refine/close tasks, implement fixes, or edit generated views.
- Missing required refs, audit evidence, fresh context, content proof, or task-boundary integrity returns `block`, not pass.

## Vertical alignment

```text
user intent -> feedback_build -> .codewiki/kb -> documentation_build -> planning_build -> roadmap item -> tests/code -> implementation_build
```

Check that accepted build refs, requirement ids, evidence mapping, changed files, checks, and closure/publication proof trace across the relevant slice of this chain.

## Horizontal alignment

Check coherence inside the relevant layer:

- knowledge docs agree with each other;
- planning builds agree with roadmap tasks;
- roadmap tasks agree with sibling tasks and sprint boundaries;
- builds agree with source layer and policy;
- code components agree with surrounding code;
- tests agree with intended behavior.

## Task boundary gate

For planning, implementation, and task-close validation, first judge whether the roadmap item is executable work:

- A task must be self-contained, with clear boundaries, direct acceptance criteria, and independent validation evidence.
- A task must not exist only to group, coordinate, sequence, or close other tasks.
- A sprint may cluster related tasks and own aggregate outcome/priority/sequencing; a task may not duplicate that role.
- Acceptance criteria that mostly say other `TASK-###` items are closed, done, or validated are container-task evidence.
- Shared file paths are allowed only when ownership remains non-overlapping and each task can pass independently.

Return `block` when a task is actually a sprint/umbrella/container or when its boundaries overlap sibling tasks without explicit dependency/split rationale.

## Isolation and content proof

Implementation, task-close, publication, publish, and release profiles require fresh validation posture before they can pass.

Implementation validation requires:

- `fresh_context=true`;
- explicit clean-state value;
- required audit refs/reports;
- checked content proof such as `validated_sha`, `tree_sha`, or `working_tree_digest`;
- commit-ready `implementation_build` evidence when policy requires it.

Task-close/publication/publish/release validation is stricter:

- `fresh_context=true`;
- `clean=true`;
- immutable content proof such as `validated_sha`, `head_sha`, `published_sha`, `tree_sha`, `package_digest`, `archive_ref`, or `remote_ref`.

Working-tree digest alone can pass dirty pre-commit implementation validation when policy allows it. It cannot pass task-close or publication boundaries.

## Workflow

1. **Confirm profile and source**
   - Identify profile: `feedback`, `documentation`, `implementation`, `task-close`, `drift-audit`, `graph-audit`, publication/publish/release, or configured equivalent.
   - Read the compact handoff/build first.
   - If policy requires fresh context and current context is not acceptable, request/consume `codewiki_session_handoff` instead of judging.

2. **Load minimal context**
   - Run `codewiki_state refresh=true` when needed.
   - Read submitted build, task, KB refs, touched code/test paths, checks, audit refs, and proof refs directly.

3. **Run or review audits**
   - Run `codewiki_audit` profiles required by policy.
   - Pass reports must cite audit refs/reports when required.

4. **Validate policy and traceability**
   - Check build kind/profile, source refs, accepted upstream build refs, change type, requirement ids, evidence mapping, and exit criteria.

5. **Validate task boundary and scope**
   - Apply the task boundary gate where applicable.
   - Check non-goals and sibling-task overlap.

6. **Validate acceptance one by one**
   - For each criterion, decide `pass`, `fail`, or `unknown` with source evidence.
   - Unknown required criteria usually block unless policy allows partial validation.

7. **Validate proof requirements**
   - Check fresh context, clean state, checked content proof, audit refs, and commit/publication readiness for profiles that require them.

8. **Record verdict**
   - Use `codewiki_validation` when a durable report is required.
   - Include profile, source/build refs, audit refs/reports, checks, issues, failed criteria, blocking questions, and isolation/content proof fields.

## Verdicts

- `pass`: submitted source satisfies policy and can be consumed by the next loop/gate.
- `fail`: a requirement, criterion, alignment assertion, or evidence mapping is proven wrong or incomplete.
- `block`: validation cannot safely decide because context, checks, schema, source refs, accepted build traceability, policy, isolation evidence, task meaning, or task/sprint boundary integrity is insufficient.

## Output

End with deterministic gateway result:

- profile;
- source/build refs checked;
- task id if applicable;
- verdict and concise rationale;
- audit refs/reports;
- checks reviewed/run;
- vertical and horizontal alignment status;
- acceptance/task-boundary findings;
- failed criteria or blocking questions;
- isolation fields (`fresh_context`, `clean`, role, builder/validator separation, checked proof refs);
- next routing recommendation.

## Related skill files

- ../../codewiki-validation/SKILL.md
- ../../codewiki-validation/references/tools.md

## Related docs

- ../../../.codewiki/kb/system/validation-gateway.md
- ../../../.codewiki/kb/system/compilers.md
- ../../../.codewiki/kb/system/builds.md
