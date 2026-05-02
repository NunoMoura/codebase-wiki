---
id: spec.product.users
title: Product Users
state: active
summary: User classes CodeWiki must serve.
owners:
  - product
updated: "2026-05-01"
---

# Product Users

## Human maintainers

Maintainers use CodeWiki to keep project intent, roadmap state, and implementation evidence close to the repository. They need a status surface that explains what is current, what changed, and what needs a decision.

## Pi coding agents

Pi agents use CodeWiki as persistent project memory. They should consume generated views for navigation, update canonical knowledge and roadmap tasks when intent changes, and avoid loading raw wiki history by default.

## AI subagents

Subagents run focused work with fresh context windows. They support verification, research, architecture review, planning review, and other bounded tasks where isolating context reduces token cost and bias from parent-session RAM.

## Workflow/package authors

Package authors use CodeWiki's structure and capability contracts without adopting CodeWiki as a sandbox or telemetry runtime. They need stable semantics for task mutation, state reads, evidence recording, and view rebuilds.

## Future external clients

Future clients may include CLI, TUI, MCP, editor panels, service agents, and optional runtime programs. These clients should read views and call typed capabilities instead of editing generated files or internal state directly.

## Related docs

- [Product](overview.md)
- [Stories](stories.md)
- [Surfaces](surfaces.md)
