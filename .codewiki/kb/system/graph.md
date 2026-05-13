---
id: spec.system.graph
title: Graph
state: active
summary: Generated hot state machine and source index for reconciliation, routing, freshness, and requirement traceability.
owners:
  - architecture
updated: "2026-05-13"
code_paths:
  - .codewiki/index_graph.json
  - extensions/codewiki/src/application/graph.ts
  - extensions/codewiki/src/application/state-builders.ts
  - extensions/codewiki/src/infrastructure
---

# Graph

## Responsibility

The graph is the generated map and hot state index for CodeWiki. It is a rebuildable state machine over canonical inputs and discoverable code/test facts.

The graph routes agents to the smallest useful next context, detects drift, reports freshness, exposes scoped roadmap/sprint/task views, and selects the next loop: feedback, documentation, planning, implementation, validation, or observe. It also supplies the agency controller and CodeWiki UI with safe next-action and stop-reason signals.

The graph does not decide intended behavior and does not replace source-of-truth reads. It points to the relevant cycle builds, knowledge docs, planning builds, roadmap items, validation reports, and code/test paths; agents must read those sources directly before making semantic changes.

Alignment is sourced from cycle builds, KB docs, planning builds, roadmap tasks, tests/code, implementation builds, and validation evidence. The graph reports alignment gaps; it does not own requirements or solve alignment by itself.

## Inputs

The graph is generated from:

```text
.codewiki/config.json
.codewiki/kb/** frontmatter, paths, explicit refs, and curated Markdown links
.codewiki/builds/**
.codewiki/roadmap/**
.codewiki/validation/**
.codewiki/runtime/claims.json active scoped change claims
.codewiki/runtime/diff-tables.json pending feedback decision rows
code/test manifests
Git/source fingerprints
```

Curated Markdown links are one input, not the full graph. The graph should compute backlinks, stale references, cross-layer traceability, freshness, and routing relationships so humans do not need to maintain exhaustive wiki-link meshes by hand.

## Output

The primary graph output is:

```text
.codewiki/index_graph.json
```

The CodeWiki UI graph view reads this file through CodeWiki API or local UI transport and renders it visually. The visual graph is a generated-state projection; it must not become separate truth.

The graph should serve status, queue-order, and parallel-claim reads directly. Extra queue files should not be generated unless a future adapter proves a concrete performance need; if such caches exist, they are generated graph queries and never separate truth.

## Hot state machine

The graph should model cross-layer items with:

- `state`: `aligned`, `drift`, `blocked`, `stale`, or `unknown`,
- `direction`: `downward`, `upward`, or `gateway`,
- `from_layer` and `to_layer`,
- `next_loop`: `feedback`, `documentation`, `planning`, `implementation`, `validation`, or `observe`,
- `reason`,
- source fingerprints for freshness.

Reconciliation items should represent actionable, unconsumed handoffs and traceability gaps. Accepted feedback, documentation, or planning builds are not drift once explicit consumes/produces build DAG edges, downstream builds, roadmap changes, implementation evidence, or passing validation link back to them. This keeps the graph as a generated map over evidence instead of making lifecycle metadata the only source of completion truth.

The graph should keep hot context small. Hot state includes active tasks, active sprints, active claims, latest active or superseding cycle builds, unconsumed handoffs, fail/block validation, current publication blockers, freshness/drift routes, and compact traceability gaps. Warm and cold evidence must stay available only through explicit archive, restore, audit, or refinement workflows. It must not enter the default CodeWiki operating context, agency context, status summary, or user-facing graph view.

For Git-backed archival, the graph should prefer compact cold references over expanded cold artifact nodes. A cold task or sprint can be represented by a ledger row containing ids, archive ref, commit sha, digest, restore command, and safety status. Default graph views should hide these cold refs and restore indexes unless the caller explicitly asks for archive context.

## Requirement traceability

The graph should expose a compact requirement traceability matrix derived from source truth. It should not store requirements as new truth.

A useful traceability row connects:

```text
requirement id
  -> feedback_build row/decision
  -> knowledge doc clause
  -> documentation_build evidence
  -> planning_build task/acceptance mapping
  -> roadmap task
  -> tests/code evidence
  -> implementation_build
  -> validation verdict
```

The graph should report gaps such as:

- accepted requirement has no knowledge mapping,
- knowledge change has no planning build when executable work is needed,
- planning build has no roadmap task or acceptance mapping,
- implementation work has no test or justified test-design evidence,
- code changed without upstream requirement/task coverage,
- validation pass does not reference the submitted build or requirement ids.

Traceability should be compact in the default graph. Full historical rows, superseded cycles, and cold pass validation should be expanded only for explicit archive, restore, or audit requests.

## Edges

Graph edges should explain why context is relevant. Useful edge kinds include:

- `captures_intent`,
- `documents`,
- `specifies`,
- `plans`,
- `implements`,
- `tests`,
- `validates`,
- `blocks`,
- `depends_on`,
- `drifts_from`,
- `derives_from`,
- `claim_task`,
- `claim_build`,
- `claim_scope`,
- `sprint_task`,
- `sprint_knowledge_scope`,
- `sprint_code_scope`,
- `build_consumes_*`,
- `build_produces_*`,
- `requirement_*` traceability edges.

## Freshness

Graph state is valid only when it matches source fingerprints. If graph state and canonical inputs disagree, canonical inputs win and the graph is stale or broken.

Freshness anchors must ignore generated graph/view artifacts such as `.codewiki/index_graph.json`; otherwise a no-op rebuild would make the graph stale against itself. Source files, knowledge files, roadmap truth, builds, validation reports, and mapped non-generated code remain valid freshness inputs.

Freshness should use deterministic input fingerprints rather than volatile generated timestamps or a final commit SHA that cannot be known before publication. Spec/doc freshness must include source content or a reliable source digest; otherwise documentation changes can avoid stale detection.

Status, `codewiki_state`, and CodeWiki UI views must consume the graph reconciliation next action when it is non-observe. They may summarize lint or spec drift, but they must not report a separate unresolved drift action while graph reconciliation claims the system is aligned. Actionable deterministic lint drift should enter graph reconciliation unless an open roadmap task already covers that spec path. Advisory lint signals, such as large-document token-budget warnings, may keep health yellow without forcing a compiler route.

## Invariants

- `.codewiki/index_graph.json` is generated and must not be hand-edited.
- The graph must be reproducible from canonical inputs and source fingerprints.
- The graph should route to exact files instead of inlining large docs, code, logs, or old task history.
- Default graph/status/state consumers should receive hot working-set context only; archive refs, closed task bodies, old pass validation, superseded cycle detail, and restore indexes require an explicit archive/restore/audit request.
- The graph should flag deterministic file-contract drift, including deprecated `.codewiki/index/**`, deprecated default `.codewiki/evidence/**`, and legacy dot-wiki path references in active contract/source files.
- The graph does not replace builds, knowledge, roadmap work items, validation reports, or code/tests; those remain the sources of truth.
- The graph should make gated agency and CodeWiki UI stop reasons explicit when state is stale, blocked, unsafe, missing approval, or blocked by overlapping write claims.
- The graph should expose active claim counts, read/write warnings, and write/write conflicts, while claims remain temporary coordination state rather than source-of-truth behavior.
- The graph should surface claim role/worktree metadata and validation isolation evidence so CodeWiki UI, status, and audits can distinguish builder, validator, and publisher contexts.
- The graph should own machine backlinks and exhaustive relationship discovery; knowledge docs should keep only intentional human-facing links.

## Related docs

- [CodeWiki UI](control-room-ui.md)
- [Knowledge](knowledge.md)
- [Roadmap](roadmap.md)
- [Builds](builds.md)
- [Compilers](compilers.md)
- [Validation Gateway](validation-gateway.md)
