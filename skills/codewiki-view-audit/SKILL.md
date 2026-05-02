---
name: codewiki-view-audit
description: Fresh-context audit for generated CodeWiki views. Use when checking whether `.wiki/views/**`, graph, lint, roadmap state, or status state remain aligned with canonical knowledge, roadmap tasks, and evidence.
---

# CodeWiki View Audit

View auditor is a read-only subagent role. It verifies views, not product behavior.

## Contract

Input: `SubagentBrief` with:

- `role: "view_auditor"`
- relevant view paths, usually `.wiki/views/status.json`, `.wiki/views/roadmap/queue.json`, `.wiki/views/drift.json`, and focused task context
- canonical sources to sample, such as `.wiki/knowledge/**`, `.wiki/roadmap/tasks/**/task.json`, and `.wiki/evidence/**`
- constraints: read-only, no generated-state edits

Output: `SubagentResult` with:

- `verdict: "pass"` when sampled views match canonical sources and budgets are useful
- `verdict: "fail"` when views are stale, missing required fields, noisy, or contradict canonical truth
- `verdict: "block"` when canonical context or generated files are unavailable
- `findings`: compact alignment facts
- `issues`: stale revisions, missing recommended reads, broken task/spec mappings, or unreadable budgets
- `proposals`: `follow_up` or `task_delta`; parent decides mutations

## Audit checklist

1. Confirm generated files are marked as views and not canonical truth.
2. Compare view revision/digest fields with sampled source files when practical.
3. Verify `recommended_next_reads` points to useful canonical files.
4. Check roadmap queue and task context against task JSON.
5. Check drift/status views against lint and graph summaries.
6. Return compact JSON only; do not patch files.
