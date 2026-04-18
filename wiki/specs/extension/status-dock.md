---
id: spec.extension.status-dock
title: Status Dock v1
state: active
summary: Unified status dock and expanded inspector rules for showing spec drift, roadmap coverage, and next action from one status read model.
owners:
- engineering
updated: '2026-04-18'
code_paths:
- extensions/codewiki/index.ts
- extensions/codewiki/templates.ts
- scripts/rebuild_docs_meta.py
---

# Status Dock v1

## Intent

codewiki should present one primary status UX instead of splitting attention across a flat `/wiki-status` text dump and a separate roadmap-only widget.

The status dock is the entry door for understanding a project. At a glance it should answer:

- what is the current wiki health?
- which specs drift against the codebase or roadmap?
- is that delta already represented by roadmap tasks?
- what should the user do next?

## Primary UX rule

The first-party status surface is the **status dock** rendered above the editor.

It replaces the old roadmap-only widget as the default always-on ambient UI when status visibility is enabled.

`/wiki-status` remains available in v1, but it is no longer the primary experience. It should:

- refresh deterministic status data
- render an expanded inspector view from the same status read model
- optionally trigger a concise direction/review follow-up
- act as the control surface for dock configuration in interactive use

## Source of truth rule

The dock itself is **not** the source of truth.

Status UX should read from a generated, repo-local read model:

- `.wiki/status-state.json`

That file exists so:

- the dock and expanded inspector render from the same deterministic state
- future UIs do not need to re-derive status by reparsing multiple files
- drift, roadmap coverage, and next-step recommendation can stay consistent across UI surfaces

Canonical write surfaces remain:

- `wiki/specs/**`
- `wiki/roadmap.json`
- `.wiki/registry.json`
- `.wiki/lint.json`
- `.wiki/roadmap-state.json`
- Pi session task-link entries for live focus

## `.wiki/status-state.json` contract

Minimum fields:

- generation timestamp
- project label and status scope metadata needed for rendering
- deterministic health snapshot (`green`, `yellow`, `red`)
- compact metrics for:
  - total specs
  - mapped specs
  - aligned specs
  - tracked drift specs
  - untracked drift specs
  - blocked drift specs
  - unmapped specs
  - roadmap total/open/done counts
- bar-ready aggregates for:
  - tracked drift coverage
  - roadmap completion
  - spec mapping coverage
- per-spec derived status rows with:
  - path
  - title
  - drift status (`aligned`, `tracked`, `untracked`, `blocked`, `unmapped`)
  - mapped code paths
  - compact code-area label
  - related lint issue counts
  - related roadmap task ids
  - primary roadmap task summary when present
  - compact note explaining why the spec is in that state
- ordered high-signal views for:
  - risky specs first
  - open roadmap tasks relevant to drift
- deterministic next-step recommendation with:
  - command string
  - short reason
  - action kind (`fix`, `code`, `review`, `observe`)

The read model should remain deterministic and should not require an LLM.

## Drift classification rule

Per-spec drift status should use these mutually exclusive states:

- `aligned` — mapped spec, no open roadmap delta, no deterministic issue signal
- `tracked` — spec has open roadmap delta already represented in roadmap work
- `untracked` — deterministic signal exists but no open roadmap task represents it
- `blocked` — relevant roadmap work exists but is currently blocked
- `unmapped` — spec has no mapped code area, so alignment confidence is weak

Rendering may add icons/colors, but the state values stay canonical in the read model.

## Default dock content

The default `standard` dock should show, in this order:

1. hero strip
2. compact bars
3. top risky specs
4. next action

### Hero strip

The hero strip should be concise and visually dominant.

It should show:

- project label
- active repo indicator when pinned or outside cwd
- health chip (`green`, `yellow`, `red`)

### Compact bars

Default bars:

- tracked drift coverage
- roadmap completion

Optional in fuller modes:

- spec mapping coverage

Bars should use health-standard colors where possible and may include percentages when the denominator is obvious.

### Top risky specs

The default dock should show only the top few risky specs, sorted worst-first.

Each row should show:

- drift icon
- spec label
- compact code-area label
- primary roadmap task id or `—`

The dock should not dump the full spec set.

### Next action

The dock should end with one strong recommendation.

Examples:

- `/wiki-fix both`
- `/wiki-code TASK-018`
- `/wiki-review architecture`
- `Observe — roadmap clear`

The recommendation should be derived from deterministic state, not from an LLM.

## Expanded inspector rule

The expanded status inspector should reuse the same hero and bar model, then add a reduced drift table.

Default columns:

- `Spec`
- `Drift`
- `Code area`
- `Task`

The inspector should avoid noisy or unclear columns like raw code-path counts unless the user explicitly expands further in future versions.

## Persistent visibility modes

The dock should support user-owned visibility modes:

- `auto` — show the repo under current cwd when one exists; otherwise hide unless a pinned repo is configured for global sessions
- `pin` — when current cwd is outside a repo-local wiki, keep showing the pinned repo
- `off` — never show the dock

These preferences are user-level UI state, not repo-owned wiki truth.

They should therefore persist in user-owned extension state, not in `wiki/` or `.wiki/`.

## Density presets

The dock should support three presets before exposing arbitrary custom module composition:

- `minimal`
- `standard`
- `full`

### `minimal`

Show:

- hero strip
- next action

### `standard`

Show:

- hero strip
- tracked drift coverage bar
- roadmap completion bar
- top risky specs
- next action

### `full`

Show:

- hero strip
- tracked drift coverage bar
- roadmap completion bar
- spec mapping bar
- top risky specs
- top open roadmap items
- next action
- short deterministic direction text

## Direction text rule

Short direction text may appear in `full` mode or expanded inspector output.

It should be concise and operational, not a long report.

Examples:

- `1 untracked spec drift needs roadmap coverage before implementation continues.`
- `Roadmap covers current delta; resume focused task after fixing blocked work.`

Longer narrative analysis belongs to `/wiki-review`, not to the always-on dock.

## Session behavior

The dock should refresh on:

- session start
- turn start
- deterministic rebuild completion
- roadmap mutations
- task focus changes
- dock configuration changes

When current cwd is inside a repo with `.wiki/config.json`, that repo should take precedence over any pinned global repo.

When current cwd is outside any repo-local wiki:

- `auto` mode may hide the dock unless a pinned repo is configured
- `pin` mode may continue to show the pinned repo

## Compatibility rule

Public command surface stays:

- `/wiki-bootstrap`
- `/wiki-status`
- `/wiki-fix`
- `/wiki-review`
- `/wiki-code`

`/wiki-status` should accept dock control subcommands rather than adding a separate public toggle command.

Examples of allowed control shape in v1:

- `/wiki-status dock auto`
- `/wiki-status dock pin [repo-path]`
- `/wiki-status dock off`
- `/wiki-status dock minimal|standard|full`

## Related docs

- [Extension Runtime](overview.md)
- [Roadmap State and TUI](roadmap-ui.md)
- [Package Surface](../package/overview.md)
- [Roadmap](../../roadmap.md)
