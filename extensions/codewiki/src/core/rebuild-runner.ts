import { resolve } from "node:path";
import type { WikiProject } from "./types";
import { withLockedPaths } from "../../mutation-queue";

export interface CoreRebuildRunner {
	run(project: WikiProject): Promise<void>;
}

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

export function rebuildTargetPaths(project: WikiProject): string[] {
	return [
		...(project.indexPath ? [resolve(project.root, project.indexPath)] : []),
		...(project.roadmapDocPath
			? [resolve(project.root, project.roadmapDocPath)]
			: []),
		resolve(project.root, project.eventsPath),
		...GENERATED_METADATA_FILES.map((fileName) =>
			resolve(project.root, project.metaRoot, fileName),
		),
		...GENERATED_VIEW_FILES.map((fileName) =>
			resolve(project.root, project.viewsRoot, fileName),
		),
	];
}

export async function runRebuildWithRunner(
	project: WikiProject,
	runner: CoreRebuildRunner,
): Promise<void> {
	return withLockedPaths(rebuildTargetPaths(project), async () => {
		await runner.run(project);
	});
}

export async function runRebuildUnlockedWithRunner(
	project: WikiProject,
	runner: CoreRebuildRunner,
): Promise<void> {
	await runner.run(project);
}
