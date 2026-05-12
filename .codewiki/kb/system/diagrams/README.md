---
id: spec.system.diagrams
state: active
title: System Diagram Raw Data
summary: Agent-editable raw data contract for project diagrams rendered by CodeWiki UIs.
owners:
  - architecture
  - design
updated: "2026-05-12"
---

# System Diagram Raw Data

This folder stores canonical raw data for system diagrams. The raw data should be easy for agents to read, edit, diff, and validate. The UI can render these specs as Mermaid, Cytoscape, custom SVG, or another local renderer, but renderer output is not canonical truth unless a future task explicitly promotes it.

## Format rule

Use YAML as the default canonical format.

Each diagram should include:

- `schema_version`
- `id`
- `title`
- `kind`
- `purpose`
- `source_docs`
- renderer hints
- diagram-specific raw data such as nodes, edges, participants, entities, states, transitions, and UI hints

Agents should prefer small stable IDs, explicit source paths, and short labels. Long explanations belong in component Markdown docs, product docs, roadmap tasks, builds, or validation reports.

## Core diagram set

| File | Kind | Purpose | Preferred rendering |
| --- | --- | --- | --- |
| `context-map.yaml` | `context_map` | Show users, access surfaces, external systems, and the project boundary. | Graph/SVG or Mermaid flowchart. |
| `component-map.yaml` | `component_map` | Show major runtime components, adapters, data stores, and dependency direction. | Cytoscape/custom SVG or Mermaid flowchart. |
| `key-flow.yaml` | `sequence_flow` | Show the most important user/agent workflow end to end. | Mermaid sequence diagram or custom sequence renderer. |
| `data-model.yaml` | `data_model` | Show durable entities, generated state, evidence, and ownership. | Mermaid ER/custom ER renderer. |
| `state-lifecycle.yaml` | `state_lifecycle` | Show task, compiler, validation, build, and release lifecycles. | Mermaid state diagram or custom state renderer. |

## Rendering boundaries

- The UI may render a diagram picker from this folder.
- Selecting a node, edge, entity, state, or sequence step should open source-backed inspector detail.
- Diagram files should not duplicate full component docs.
- Generated graph state remains `.codewiki/index_graph.json`; diagram files are intended system knowledge.
- `../architecture.mmd` remains a compatibility component diagram during migration, but new diagram work should target this folder.

## Related docs

- [Control Room UI](../control-room-ui.md)
- [File Structure](../file-structure.md)
- [System Overview](../overview.md)
