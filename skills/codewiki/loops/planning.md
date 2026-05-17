# CodeWiki Planning

Run the planning compiler after validated documentation. Prefer the dedicated `codewiki-planning` skill for full planning-mode instructions.

```text
validated documentation_build -> codewiki_state + active task review -> codewiki_task create/update -> planning_build -> planning validation -> implementation handoff
```

## Rules

- Planning consumes validated `documentation_build` evidence and aligns roadmap work with updated knowledge.
- Planning owns roadmap task shape. Documentation owns knowledge. Implementation owns code/tests.
- Use `codewiki_task` for roadmap changes, including `action="sprint"` for accepted sprint metadata. Never edit `.codewiki/roadmap/queue.json` or generated `.codewiki/roadmap/tasks/**` by hand.
- Inspect active tasks and active sprint scope before creating work. Prefer refinement when intent, paths, or labels overlap.
- Create only self-contained executable tasks with direct outcomes, acceptance criteria, non-goals, verification, and independent evidence.
- Reject coordination-only, sprint/container, or close-other-tasks-only work as roadmap tasks.
- Use `codewiki_build kind="planning"` after roadmap alignment and before implementation starts.
- Start planning work from the documentation build in a fresh session or recorded context reset when this loop follows documentation.

## Workflow

1. **Confirm source build**
   - Read the validated `documentation_build` and restate requirements, changed knowledge refs, non-goals, blockers, risks, and open questions.
   - If no validated documentation/source route exists, return to documentation or validation.

2. **Inspect current state**
   - Run `codewiki_state` first.
   - Read active task/sprint context and relevant KB refs.
   - Surface drift between knowledge, roadmap, and code instead of silently choosing.

3. **Analyze executable delta**
   - Decide which requirements need work and which are knowledge-only.
   - Identify candidate code/test paths and test-design/TDD strategy.
   - Map each planned task acceptance criterion to requirement ids and knowledge/build refs.

4. **Shape tasks**
   - Refine overlapping active tasks where possible.
   - Create new tasks only for independent work.
   - Define `goal.outcome`, `goal.acceptance`, `goal.non_goals`, `goal.verification`, candidate paths, blockers, and labels.
   - For related executable cohorts, use `codewiki_task action="sprint"` with task ids, scope, budget, gates, and shared outcome.

5. **Mutate roadmap truth**
   - Call `codewiki_task action="create"` or `action="update"`.
   - Add evidence for refinements, blocked work, or explicit no-task decisions.
   - Mark narrow artifact status when parallel work may overlap roadmap/build refs.

6. **Emit planning build**
   - Call `codewiki_build kind="planning"`.
   - Include `source_documentation_build`, `task_ids`, `task_changes`, `tdd_plan`, `candidate_test_files`, `candidate_code_paths`, requirements, evidence mapping, assumptions, open questions, non-goals, and risks.

7. **Validate planning**
   - Check documentation -> roadmap -> planning_build vertical alignment.
   - Check task boundary quality and duplicate/overlap risk.
   - Use audit and validation tools when policy or risk requires them.

8. **Route next loop**
   - Hand off to implementation with the `planning_build` ref and target task id.
   - If no executable work exists, stop with no-task evidence and validation/audit refs.

## Verification

After planning:

- `codewiki_state refresh=true` is green or drift is explicitly routed.
- Created/refined tasks are atomic and executable.
- Planning build covers task ids, task changes, TDD/test strategy, and candidate paths.
- Implementation handoff starts from the planning build, not chat memory.

## Related skill files

- ../../codewiki-planning/SKILL.md
- ../../codewiki-planning/references/tools.md
