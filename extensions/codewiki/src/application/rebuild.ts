/**
 * application/rebuild.ts
 *
 * "Run a rebuild" use case.
 * Orchestrates the rebuild pipeline via the RebuildRunner port.
 * No knowledge of how the rebuild is actually executed (Python script, engine, etc.).
 */

import type { WikiProject } from "../domain/shared/types";
import type { RebuildRunner } from "./ports";
import { withLockedPaths } from "../../mutation-queue";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Path helpers (pure — no I/O)
// ---------------------------------------------------------------------------

const GENERATED_METADATA_FILES = [
	"graph.json",
	"lint.json",
	"roadmap-state.json",
	"status-state.json",
];

const GENERATED_VIEW_FILES = [
	"roadmap-summary.md",
	"status-dock-v1.json",
	"status-dock-v1.txt",
];

/**
 * Returns all paths that participate in a rebuild lock.
 * Callers acquire this lock before mutating canonical files to prevent races.
 */
export function rebuildTargetPaths(project: WikiProject): string[] {
	return [
		...(project.indexPath ? [resolve(project.root, project.indexPath)] : []),
		...(project.roadmapDocPath
			? [resolve(project.root, project.roadmapDocPath)]
			: []),
		resolve(project.root, project.eventsPath),
		...GENERATED_METADATA_FILES.map((f) =>
			resolve(project.root, project.metaRoot, f),
		),
		...GENERATED_VIEW_FILES.map((f) =>
			resolve(project.root, project.viewsRoot, f),
		),
	];
}

/**
 * Run a rebuild while holding the file lock.
 * Uses the RebuildRunner port — the actual execution is in infrastructure/.
 */
export async function runRebuild(
	project: WikiProject,
	runner: RebuildRunner,
): Promise<void> {
	return withLockedPaths(rebuildTargetPaths(project), () =>
		runner.run(project),
	);
}
