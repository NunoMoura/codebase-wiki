# CodeWiki Project Boundary

This repository contains two different things named CodeWiki:

- `src/`, `skills/`, `scripts/`, `tests/`, `README.md`, and `package.json` are the package source for the CodeWiki project we are building.
- `.codewiki/` is this repository's dogfood CodeWiki state. It stores repo-local knowledge, roadmap queue/tasks, session queue state, builds, validation reports, research notes, and generated graph state for maintaining this repo.

Agents working in this repository must not treat `.codewiki/` as package source code. Edit `.codewiki/` only when updating CodeWiki dogfood knowledge, roadmap/session state, compiler builds, validation, or generated graph artifacts. Edit `src/` and `skills/` when changing the product itself.
