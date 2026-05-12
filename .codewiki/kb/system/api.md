---
id: spec.system.api
title: CodeWiki API
state: active
summary: Harness-independent semantic access contract for CodeWiki state, loops, builds, validation, graph, and publication support.
owners:
  - architecture
updated: "2026-05-11"
code_paths:
  - extensions/codewiki/src/application
  - extensions/codewiki/src/domain
  - extensions/codewiki/src/adapters
---

# CodeWiki API

## Responsibility

The CodeWiki API is the stable semantic contract used by adapters, the local Control Room UI, CLI, MCP servers, scripts, and future harness integrations. Pi tools are one adapter over this API; they must not be the only way to access CodeWiki semantics.

The API should expose CodeWiki operations as typed capabilities instead of asking external access surfaces to edit `.codewiki/` internals directly.

## Capability groups

| Capability group | Responsibility |
| --- | --- |
| `codewiki.state` | Read compact project status, graph state, active work, focused session, and exact linked context. |
| `codewiki.feedback` | Capture proposed intent, present diff tables, record accepted feedback builds. |
| `codewiki.diff_table` | Manage pending, editable feedback diff-table rows before accepted rows compile into feedback builds. |
| `codewiki.documentation` | Apply accepted feedback to product/system knowledge and produce documentation builds. |
| `codewiki.implementation` | Coordinate implementation work, evidence collection, and implementation builds. |
| `codewiki.roadmap` | Manage work truth: queue, status, priority, blockers, progress, and closure. |
| `codewiki.claim` | Manage temporary scoped change claims for parallel session coordination across knowledge, roadmap, code, builds, validation, and graph/source refs. |
| `codewiki.agency` | Run bounded roadmap, sprint, or task automation through token, time, cost, write, session, risk, validation, policy, and approval gates. |
| `codewiki.build` | Read and write accepted compiler build briefs. |
| `codewiki.validation` | Run validation gateways and persist failed, blocked, or policy-kept reports. |
| `codewiki.graph` | Rebuild and read the generated graph state machine. |
| `codewiki.control_room` | Serve local-first UI read models and route UI actions through existing CodeWiki capabilities. |
| `codewiki.patch` | Apply validated CodeWiki patches or append-only source/research writes under policy. |
| `codewiki.publication` | Prepare commit, PR, issue, changelog, release, and push-readiness outputs from implementation evidence. |

## Access paths

| Access surface | Path |
| --- | --- |
| Control Room UI | Local browser command center over the same API and generated graph state. |
| Pi | Extension commands, tools, compact visual status UI, Control Room launcher, skills, and session integration. |
| Claude Code | CLI or MCP adapter over the same API. |
| Codex | CLI or MCP adapter over the same API. |
| Other agents | CLI, MCP, or package API. |
| Humans | Local Control Room, CLI/status output, generated docs, and host-native compact panels. |

All access surfaces must preserve the same `.codewiki/` semantics.

## Write rules

- Product/system changes flow through feedback and documentation loops.
- Code/test changes flow through implementation loops.
- Roadmap changes record work truth, not full requirements briefs.
- Roadmap task creation must check active work for related intent and refine matching tasks before creating duplicates.
- Parallel sessions should use scoped change claims before non-trivial overlapping documentation, roadmap, build, validation, or code edits.
- Claims are temporary coordination leases; they do not replace roadmap tasks, builds, validation, git, or code review.
- Claim callers may provide role/worktree metadata for builder, validator, publisher, or observer sessions so status and graph views can explain isolation without making claims the filesystem source of truth.
- Validation callers may provide isolation metadata such as fresh-context status, worktree path, branch, base/head/validated SHA, and clean worktree result when independence matters.
- Gated agency runs must respect token, time, cost, write, session, risk, validation, policy, and approval gates.
- Pending diff tables are runtime/session decision surfaces; accepted rows become feedback build truth. The Control Room Diff view and compact status-panel Diff tab can approve, reject, defer, or attach alternatives to pending rows.
- Builds are accepted loop handoff briefs and should expose explicit consumes/produces edges.
- Config schema v4 defines quiet rebuild defaults, scoped agency budgets, parallelism/session-per-sprint policy, and hot/warm/cold/purge garbage-collection windows.
- Generated graph/index state is never hand-edited.
- Failed, blocked, policy-required, current-publication, release, or audit-mode validation reports persist under `.codewiki/validation/**`; pass reports should be evicted after safe Git archival/publication.
- Deprecated `.codewiki/index/**` and default `.codewiki/evidence/**` paths must not be created by normal API flows.
- Commit, push, release, and remote updates require implementation evidence plus validation/policy approval.

## API boundary

The API belongs in application use cases and domain contracts. Adapters and the CodeWiki UI transport translate external inputs and outputs. Infrastructure implements filesystem, Git, process, persistence, patch application, and graph rebuild ports.

The API should stay stable while adapter protocols change.

## Related docs

- [Control Room UI](control-room-ui.md)
- [Adapters](adapters.md)
- [Agency Controller](agency.md)
- [Compilers](compilers.md)
