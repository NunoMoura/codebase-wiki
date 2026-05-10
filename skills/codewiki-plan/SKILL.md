---
name: codewiki-plan
description: Documentation compiler for CodeWiki. Use when accepted feedback, architecture changes, drift, or roadmap gaps need to become `.codewiki/kb/**` updates and executable roadmap task packs before implementation.
id: skill.codewiki-plan
title: codewiki-plan skill
state: active
summary: Packaged CodeWiki agent skill.
owners: [maintainers]
updated: "2026-05-10"
---

# CodeWiki Plan

Run the documentation compiler. The user should not need to trigger each stage manually once the feedback build is accepted.

```text
accepted feedback_build -> inspect current kb/roadmap/graph -> update knowledge -> create/update task packs -> documentation validation
```

## Rules

- `.codewiki/kb/**` is canonical intended knowledge.
- The feedback compiler owns unresolved user intent. If intent is ambiguous, escalate back to feedback instead of guessing.
- Roadmap tasks are the executable delta from intended knowledge to current reality.
- Keep decisions close to owning specs; do not create a parallel ADR system by default.
- Use `codewiki_state` first; treat status/graph/build revisions as the parent session's RAM anchors.
- Expand raw knowledge files only when graph/build context recommends them, a decision needs exact source, or drift cannot be resolved from graph/context.
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

5. **Create/update roadmap task packs**
   - Each task needs outcome, acceptance, non-goals, validation expectations, spec links, and code paths when known.
   - Prefer thin vertical slices that are independently verifiable.
   - Mark human decision gates explicitly.

6. **Emit documentation build**
   - Record changed knowledge paths, task-pack changes, alignment checks, and deferred requirements under `.codewiki/builds/documentation/**` when useful.

7. **Run documentation validation**
   - Check feedback_build -> knowledge -> roadmap/task-pack vertical alignment.
   - Check horizontal coherence between knowledge docs and between roadmap tasks.

## Planner subagent contract

Input: `SubagentBrief` with `role: "planner"`, accepted feedback build, relevant graph/specs, current roadmap queue, and constraints.

Output: `SubagentResult` with `verdict: "pass" | "fail" | "block"`, compact findings, issues, and `proposals` of kind `knowledge_patch`, `task_delta`, or `follow_up`. Planner workers never write canonical `.codewiki/` files directly.

## Verification

After planning:

- Run `codewiki_state` with refresh when generated state may be stale.
- Confirm open tasks cover active delta.
- Confirm no unmapped knowledge/code drift was introduced.

## Related docs

- ../../.codewiki/kb/system/compilers.md
- ../../.codewiki/kb/system/validation-gateway.md
- ../../.codewiki/kb/system/builds.md
- ../../.codewiki/kb/system/roadmap.md
