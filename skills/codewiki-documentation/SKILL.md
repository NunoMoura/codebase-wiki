---
name: codewiki-documentation
description: Documentation compiler for CodeWiki. Use when accepted feedback, architecture changes, drift, or roadmap gaps need to become `.codewiki/kb/**` updates and executable roadmap work items before implementation.
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
accepted feedback_build -> use graph to locate sources -> read kb/roadmap/build truth -> update knowledge -> create/update roadmap items -> documentation validation
```

## Rules

- `.codewiki/kb/**` is canonical intended knowledge.
- The feedback compiler owns unresolved user intent. If intent is ambiguous, escalate back to feedback instead of guessing.
- Roadmap tasks are the executable delta from intended knowledge to current reality.
- Keep decisions close to owning specs; do not create a parallel ADR system by default.
- Use `codewiki_state` first as a map and freshness/drift index; treat loaded graph/build revisions as parent-session RAM anchors.
- Use the graph to locate relevant sources, then read KB, build, roadmap, validation, or code truth directly before making semantic changes.
- Expand raw knowledge files only when graph/build context points there, a decision needs exact source, or drift cannot be resolved from the located sources.
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

5. **Create/update roadmap work items**
   - Each task needs outcome, acceptance, non-goals, validation expectations, spec links, and code paths when known.
   - Prefer thin vertical slices that are independently verifiable.
   - Mark human decision gates explicitly.

6. **Emit documentation build**
   - Record changed knowledge paths, roadmap item changes, alignment checks, and deferred requirements under `.codewiki/builds/documentation/**` when useful.

7. **Run documentation validation**
   - Check feedback_build -> knowledge -> documentation_build -> roadmap item vertical alignment.
   - Check horizontal coherence between knowledge docs and between roadmap tasks.

## Planner subagent contract

Input: `SubagentBrief` with `role: "planner"`, accepted feedback build, graph-located specs/roadmap/builds, graph-derived open-task ordering, and constraints.

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
