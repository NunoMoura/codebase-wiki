---
name: codewiki-research
description: Research workflow for CodeWiki knowledge support. Use when external sources, library internals, implementation history, or citations are needed to justify `.wiki/knowledge` claims or planning decisions.
---

# CodeWiki Research

Research supports canonical knowledge. It is not part of every implementation loop.

## Rules

- Research evidence supports `.wiki/knowledge/**` and planning decisions.
- Execution evidence supports task closure. Keep these concepts distinct.
- Prefer local code inspection when the answer is inside the repo.
- Use web/code research when external/library/source truth is needed.
- Cite sources and capture stable facts, not generic summaries.
- Do not create a parallel docs system outside `.wiki/knowledge`.

## Workflow

1. **Define claim/question**
   - State the knowledge claim or decision the research must support.
   - Identify which owning spec may change.

2. **Gather evidence**
   - For library internals, use source-backed research with permalinks.
   - For public docs, prefer official docs and version-specific references.
   - For repo-local behavior, inspect code/tests/history directly.

3. **Synthesize**
   - Separate fact, inference, and recommendation.
   - Surface uncertainty and conflicts.

4. **Update CodeWiki**
   - Patch owning knowledge specs when intended behavior or rationale changes.
   - Create or update roadmap tasks if research exposes implementation delta.
   - Append research/source evidence using CodeWiki evidence conventions when available.

## Output shape

Return concise findings:

- claim/question
- sources consulted
- findings
- implication for `.wiki/knowledge`
- roadmap delta, if any
- uncertainty or follow-up research
