/**
 * application/setup.ts
 *
 * Project setup and bootstrap use cases.
 * Discovers or configures a CodeWiki project, optionally bootstrapping starter files.
 */
import type { WikiProject } from "../domain/shared/types";
import { resolveToolProject } from "./project";
import type { FileStore, ProjectResolver } from "./ports";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Port dependencies
// ---------------------------------------------------------------------------

export interface SetupPorts {
	fileStore: FileStore;
	projectResolver: ProjectResolver;
}

// ---------------------------------------------------------------------------
// Resolve project from cwd or override
// ---------------------------------------------------------------------------

export async function resolveProject(
	cwd: string,
	repoPath: string | undefined,
	ports: SetupPorts,
): Promise<WikiProject> {
	return resolveToolProject(cwd, repoPath, "application");
}

// ---------------------------------------------------------------------------
// Bootstrap a fresh CodeWiki project
// ---------------------------------------------------------------------------

const STARTER_KB_FILES: Array<{ path: string; content: string }> = [
	{
		path: ".codewiki/kb/system/overview.md",
		content: `# System Overview

## Architecture
- Domain: Pure business logic with zero framework imports.
- Application: Use cases orchestrate domain through ports.
- Infrastructure: File I/O, git, subprocess adapters.
- Adapters: Agent-harness-specific entry points (Pi, MCP, CLI).

## Key Components
See subdirectories for detailed component docs.
`,
	},
	{
		path: ".codewiki/kb/system/components/knowledge.md",
		content: `# Knowledge Component

## Purpose
Structured documents describing the system's intended behavior, architecture, and decisions.

## Location
\`.codewiki/kb/\` — organized by system, product, runtime, clients, and infrastructure.

## Schema
Each knowledge document is a markdown file with a YAML frontmatter header containing a title and optional status.
`,
	},
	{
		path: ".codewiki/kb/system/components/roadmap.md",
		content: `# Roadmap Component

## Purpose
Describes the roadmap as the single source of truth for what to build next.

## Structure
- Roadmap file: \`.codewiki/roadmap/tasks.json\`
- Tasks are ordered by priority.
- Each task has an id, title, status, and goal.
- Evidence is recorded for each task action.
`,
	},
	{
		path: ".codewiki/kb/lexicon.md",
		content: `# Lexicon

## Core Terms

- **Compile**: Transform accepted user intent into durable documentation and executable roadmap tasks.
- **Task**: A bounded unit of work tracked in the roadmap.
- **Evidence**: Structured records of actions taken toward task completion.
`,
	},
	{
		path: ".codewiki/kb/product/overview.md",
		content: `# Product Overview

CodeWiki is a repo-local codebase wiki. It captures design intent in structured knowledge documents while keeping the roadmap as the freshest delta.
`,
	},
];

export async function bootstrapProject(
	project: WikiProject,
	opts: { force?: boolean },
	ports: SetupPorts,
): Promise<{ bootstrapped: boolean; paths: string[] }> {
	const wikiRoot = resolve(project.root, ".codewiki");
	const hasExisting = await ports.fileStore
		.maybeReadJson(`${project.metaRoot}/index_graph.json`)
		.then(() => true)
		.catch(() => false);

	if (hasExisting && !opts.force) {
		return { bootstrapped: false, paths: [] };
	}

	const paths: string[] = [];
	for (const file of STARTER_KB_FILES) {
		const fullPath = resolve(project.root, file.path);
		try {
			await mkdir(resolve(fullPath, ".."), { recursive: true });
			await writeFile(fullPath, file.content, "utf8");
			paths.push(file.path);
		} catch {
			// Skip if file already exists
		}
	}

	// Ensure meta directory structure
	await mkdir(join(project.root, project.metaRoot), { recursive: true });
	await mkdir(join(project.root, project.viewsRoot), { recursive: true });

	return { bootstrapped: true, paths };
}