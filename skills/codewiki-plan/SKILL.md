---
name: codewiki-plan
description: Automatic outer planning loop for CodeWiki. Use when user intent, ideas, architecture changes, drift, or roadmap gaps need to become `.wiki/knowledge` updates and executable roadmap tasks before implementation.
---

# CodeWiki Plan

Run the outer loop. The user should not need to trigger each stage manually.

```text
clarify → inspect → research if needed → update knowledge → create/update roadmap tasks
```

Pause only for ambiguity, product/architecture choice, destructive action, or approval policy.

## Rules

- `.wiki/knowledge/**` is canonical intended behavior.
- Research supports knowledge claims; it is not part of every task loop.
- Roadmap tasks are the executable delta from intended behavior to current reality.
- Keep decisions close to owning specs; do not create a parallel ADR system by default.
- Use `codewiki_state` first; treat its status/view revisions as the parent session's RAM anchors.
- Expand raw wiki files only when a view recommends them, a decision needs exact canonical source, or drift cannot be resolved from views.
- For outer-loop planning, read the smallest useful path: status view → roadmap queue/task packet → linked product/system/flow docs.
- Use a planning-review subagent when intent, architecture, and roadmap interactions exceed the parent context budget; ask for compact task deltas only.
- Use available bounded context tools for repo-wide inventory, graph checks, or diff summarization instead of loading broad raw output. ThinkCode is optional and governed by its own skill when installed.
- Use `codewiki_task` for task creation/update. Do not edit roadmap JSON manually.

## Workflow

1. **Clarify intent**
   - Restate outcome, users, constraints, non-goals.
   - Ask one question at a time only when the answer is not discoverable.

2. **Inspect current repo/wiki**
   - Read compact CodeWiki state first.
   - Use targeted repo tools or an available bounded context tool for programmatic context creation when raw output would be noisy.
   - Surface drift instead of silently choosing between code and wiki.

3. **Research if needed**
   - Use research only when external/library/source evidence is needed to support intended knowledge.
   - Route deeper research to `codewiki-research`.

4. **Update knowledge**
   - Patch owning `.wiki/knowledge/**` specs when intended behavior changes.
   - Preserve stable ownership seams; avoid doc sprawl.

5. **Create/update roadmap tasks**
   - Each task needs outcome, acceptance, non-goals, verification, spec links, and code paths when known.
   - Prefer thin vertical slices that are independently verifiable.
   - Mark human decision gates explicitly.

## Verification

After planning:

- Run `codewiki_state` with refresh.
- Confirm open tasks cover active delta.
- Confirm no unmapped spec/code drift was introduced.
