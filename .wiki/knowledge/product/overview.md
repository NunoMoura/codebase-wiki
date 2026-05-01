---
id: spec.product
title: Product
state: active
summary: Product intent, users, and value boundaries for codewiki.
owners:
  - product
updated: "2026-04-29"
---

# Product

## Intent

CodeWiki exists to make a repository's development intent explicit, durable, and actionable for Pi agents and humans. It owns the structure of project knowledge: product intent, system boundaries, client surfaces, roadmap tasks, evidence, generated state, and resume context.

CodeWiki should be distributed as a Pi package that works with Pi's native extension, skill, command, session, and package mechanics. It should not become a monolithic runtime or sandbox. Programmatic execution belongs to capability runtimes such as `think-code`; telemetry and evals belong to dedicated Pi extensions.

## Users

- Developers who want project intent, roadmap state, and implementation evidence to live with the repository.
- Pi agents that need a canonical source of truth for what the project is trying to do and what work is next.
- Workflow package authors who want CodeWiki's structure without taking on runtime sandboxing, telemetry, or evaluation concerns.
- Maintainers who need task continuity across compacted or forked Pi sessions.

## Success criteria

- user intent is explicit before implementation expands
- architecture and client surfaces stay grounded in product goals
- roadmap reflects approved delta from intent to current code
- Pi sessions can resume task work cleanly because sessions link back to roadmap tasks
- CodeWiki exposes a clear capability boundary that other Pi packages, especially `think-code`, can call without bypassing wiki semantics
- `.wiki` remains the project-local source of truth while runtime execution stays delegated to Pi-native tools and extensions

## Goal quality rule

Each foundational spec should define clear goals, success signals, non-goals, and verification expectations so drift can be measured instead of guessed.

## Evidence model

CodeWiki should distinguish two evidence types:

- **research evidence** supports `.wiki/knowledge` claims, design rationale, and planning decisions with local code inspection or cited external sources
- **execution evidence** supports roadmap task closure with checks run, files touched, verifier verdicts, and unresolved issues

Research evidence belongs in the outer planning loop when uncertainty or unsupported claims would otherwise make knowledge speculative. It should not be required for routine implementation when the repo, task, and acceptance criteria already provide enough intent.

## Non-goals

- duplicated narrative across many docs
- stale historical buckets mixed with live design
- manual roadmap bookkeeping as the primary user workflow
- owning a general-purpose sandbox, code execution runtime, telemetry stack, or eval framework
- requiring agents to mutate machine-managed `.wiki` files directly when a CodeWiki transaction or task API can express the same change

## Related docs

- [Clients Overview](../clients/overview.md)
- [System Overview](../system/overview.md)
