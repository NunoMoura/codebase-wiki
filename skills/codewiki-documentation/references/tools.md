# Documentation compiler tools

Use these tools in documentation mode. Canonical writes are limited to `.codewiki/kb/**`, documentation builds, validation reports when required, and runtime artifact status.

## Required sequence

1. `codewiki_state`
   - First read for repo health, active reconciliation, accepted build refs, task/session focus, and artifact status.
   - Use `refresh=true` when graph or generated state may be stale.

2. Direct file reads/edits for `.codewiki/kb/**`
   - Read owning knowledge docs before edits.
   - Edit durable intended truth only; do not store raw history or transient planning notes in KB prose.

3. `codewiki_build kind="documentation"`
   - Compile after KB edits and before planning handoff.
   - Required fields normally include `source_feedback_build`, `knowledge_changes`, `requirements`, `evidence_mapping`, `assumptions`, `open_questions`, `non_goals`, `risks`, and lower-layer planning questions.
   - Use `lifecycle.state="accepted"` when documentation edits are complete and ready for validation/planning.

## Conditional tools

- `codewiki_artifact_status`
  - Mark narrow write scopes for edited KB paths and documentation build refs when parallel overlap is possible.
  - Release when done.

- `codewiki_audit`
  - Use for deterministic evidence before documentation validation or when changed-file/graph state may drift.
  - Common profiles: `alignment`, `changed`, `generated-parity`.

- `codewiki_validation profile="documentation"`
  - Use after compiling the documentation build when policy requires validation or the verdict is fail/block/policy-required.
  - Rationale should cite feedback build refs, changed KB paths, audit refs, and any horizontal knowledge conflicts.

- `codewiki_session_handoff`
  - Use after accepted documentation build when planning must start from fresh context.
  - Expected output: `planning_build` plus roadmap task mutations when executable work exists.

## Forbidden in documentation mode

- Do not use `codewiki_diff_table` for new semantic decisions unless returning to feedback mode first.
- Do not create/refine roadmap tasks for routine executable work; route that to planning mode.
- Do not change source code or tests.
- Do not create `documentation_build` without accepted upstream feedback or an explicit validation/audit route to documentation.
- Do not duplicate full roadmap requirements briefs in KB files or documentation builds.
