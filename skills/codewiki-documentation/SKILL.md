---
name: codewiki-documentation
description: Documentation compiler for CodeWiki. Use when accepted feedback, architecture changes, drift, or roadmap gaps need to become `.codewiki/kb/**` updates and planning handoffs before roadmap/implementation work.
id: skill.codewiki-documentation
title: codewiki-documentation skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki Documentation

Run the documentation compiler. The user should not need to trigger each stage manually once the feedback build is accepted.

```text
accepted feedback_build -> use graph to locate sources -> read kb/build truth -> update knowledge -> documentation_build cycle -> validation gateway -> planning loop
```

## Rules

- `.codewiki/kb/**` is canonical intended knowledge.
- The feedback compiler owns unresolved user intent. If intent is ambiguous, escalate back to feedback instead of guessing.
- Roadmap tasks are the executable delta from intended knowledge to current reality, but routine roadmap alignment belongs to the planning loop in the target model.
- Keep decisions close to owning specs; do not create a parallel ADR system by default.
- Use `codewiki_state` first as a map and freshness/drift index; treat loaded graph/build revisions as parent-session RAM anchors.
- Use the graph to locate relevant sources, then read KB, build, roadmap, validation, or code truth directly before making semantic changes.
- Expand raw knowledge files only when graph/build context points there, a decision needs exact source, or drift cannot be resolved from the located sources.
- Use scoped change claims for non-trivial KB or roadmap edits when parallel sessions may overlap.
- Use `codewiki_task` for task creation/update. Do not edit roadmap JSON manually.

## Workflow

1. **Confirm feedback build**
   - Restate accepted outcome, constraints, non-goals, and unresolved questions.
   - If no accepted feedback build exists, create one or escalate to feedback.

2. **Inspect current CodeWiki state**
   - Read compact CodeWiki state first.
   - Use targeted repo tools or bounded context tools for programmatic context creation when raw output would be noisy.
   - Surface drift instead of silently choosing between code and knowledge.

3. **Research if needed**
   - Use research only when external/library/source evidence is needed.
   - Route deeper research to `codewiki-research`.

4. **Update knowledge**
   - Patch owning `.codewiki/kb/**` specs when intended behavior changes.
   - Preserve stable ownership seams; avoid doc sprawl.

5. **Prepare planning handoff**
   - Map approved requirement ids to changed knowledge files and clauses.
   - Record open planning questions, likely affected code/test areas, and whether executable roadmap work is needed.
   - During migration, create/update the roadmap task needed to implement planning-loop support. Once `planning_build` exists, routine task creation moves to the planning compiler.

6. **Emit documentation build**
   - Record changed knowledge paths, roadmap item changes, alignment checks, and deferred requirements under `.codewiki/builds/documentation/**` when useful.

7. **Run documentation validation**
   - Check feedback_build -> knowledge -> documentation_build vertical alignment.
   - Check horizontal coherence between knowledge docs.
   - If migration creates a roadmap task, verify that it references the documentation build and does not duplicate full requirements.

## Planner subagent contract

Input: `SubagentBrief` with `role: "planner"`, accepted feedback build, graph-located specs/roadmap/builds, graph-derived open-task ordering, and constraints.

Output: `SubagentResult` with `verdict: "pass" | "fail" | "block"`, compact findings, issues, and `proposals` of kind `knowledge_patch`, `task_delta`, or `follow_up`. Planner workers never write canonical `.codewiki/` files directly.

## Verification

After documentation:

- Run `codewiki_state` with refresh when generated state may be stale.
- Confirm changed knowledge is covered by a documentation build.
- Confirm a planning handoff or migration roadmap task covers any executable delta.
- Confirm no unmapped knowledge/code drift was introduced.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
- ../../.codewiki/kb/system/roadmap.md
