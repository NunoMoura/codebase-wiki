# codebase-wiki

Repo-local, docs-first wiki tooling for [Pi](https://github.com/mariozechner/pi-coding-agent).

This package ships **two Pi extensions**:

- **`codebase-wiki`**: operate an existing repo-local wiki
- **`codebase-wiki-bootstrap`**: scaffold a starter wiki into a repository

The goal is simple:

- keep intended design in the repo
- keep machine metadata generated and hidden
- make docs drift explicit
- give Pi slash commands for rebuild, lint, and semantic drift review

## What you get

### Bootstrap command

- `/wiki-bootstrap [project name] [--force]`

This scaffolds a starter repo-local wiki into the current repository, including:

- `.docs/config.json`
- `.docs/events.jsonl`
- `.docs/sources/`
- `scripts/rebuild_docs_meta.py`
- `docs/schema.md`
- `docs/specs/product/prd.md`
- `docs/specs/architecture/system-overview.md`
- `docs/decisions/ADR-001-documentation-wiki-model.md`
- `docs/plans/roadmap.md`
- `docs/archive/README.md`
- generated outputs like `docs/index.md`, `.docs/registry.json`, `.docs/backlinks.json`, `.docs/lint.json`

### Wiki operations

Once a repo has the wiki contract, you get:

- `/wiki-rebuild`
- `/wiki-lint`
- `/wiki-lint show`
- `/wiki-status`
- `/wiki-self-drift`
- `/wiki-code-drift`

The package also exposes LLM-callable tools:

- `codebase_wiki_rebuild`
- `codebase_wiki_status`

## Install

### From git

```bash
pi install git:github.com/NunoMoura/codebase-wiki
```

Project-local install:

```bash
pi install -l git:github.com/NunoMoura/codebase-wiki
```

### From a local checkout

```bash
pi install /absolute/path/to/codebase-wiki
```

Or try it for one run:

```bash
pi -e /absolute/path/to/codebase-wiki
```

## Quick start

### New repo

1. Install the package.
2. Open Pi in the target repo.
3. Run:

```text
/wiki-bootstrap My Project
```

4. Review and replace the starter docs.
5. Use:

```text
/wiki-rebuild
/wiki-lint
/wiki-self-drift
/wiki-code-drift
```

### Existing repo

If the repo already has a compatible wiki contract, you can skip bootstrapping and just use the operational commands.

Minimum expected contract:

```json
{
  "docs_root": "docs",
  "schema_path": "docs/schema.md",
  "index_path": "docs/index.md",
  "meta_root": ".docs",
  "codebase_wiki": {
    "rebuild_command": ["python", "scripts/rebuild_docs_meta.py"]
  }
}
```

The rebuild command should update at least:

- `docs/index.md`
- `.docs/registry.json`
- `.docs/lint.json`

## How it works

### 1. `codebase-wiki-bootstrap`

The bootstrap extension seeds a generic wiki layout and a deterministic metadata generator.

The generated structure is intentionally simple:

- `docs/` contains human-facing truth
- `.docs/` contains machine-facing metadata and source capture
- `scripts/rebuild_docs_meta.py` regenerates index, registry, backlinks, and lint output

### 2. `codebase-wiki`

The runtime extension walks upward from the current working directory looking for `.docs/config.json`.

It then uses the repo's config to:

- find the docs root and schema/index paths
- run the configured rebuild command
- read `.docs/registry.json`, `.docs/lint.json`, `.docs/events.jsonl`
- build semantic audit prompts for docs-vs-docs and docs-vs-code drift

## Philosophy

This package assumes a docs model with these properties:

- docs are source of truth for intended design
- code is implementation evidence
- there is one generated live index
- machine metadata stays hidden under `.docs/`
- archive docs exist, but do not drive live design
- drift should be visible instead of implicit

## Repo layout

```text
extensions/
  codebase-wiki/
    index.ts
  codebase-wiki-bootstrap/
    index.ts
    templates.ts
LICENSE
README.md
package.json
```

## Development

Load this repo directly in Pi while developing:

```bash
pi -e /absolute/path/to/codebase-wiki
```

Or install it from the local path:

```bash
pi install /absolute/path/to/codebase-wiki
```

## License

MIT
