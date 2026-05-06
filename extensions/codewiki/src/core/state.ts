import { dirname, resolve } from "node:path";
import type {
	WikiProject,
	LintReport,
	StatusStateFile,
	RoadmapStateFile,
	GraphFile,
	RoadmapTaskRecord,
	RoadmapTaskContextPacket,
	TaskPhase,
	RoadmapStatus,
	ToolTaskStatus,
	RoadmapStateTaskSummary,
} from "./types";
import { maybeReadJson, readJson } from "./utils";
import {
	rebuildTargetPaths,
	runRebuildWithRunner,
	runRebuildUnlockedWithRunner,
	type CoreRebuildRunner,
} from "./rebuild-runner";
export { rebuildTargetPaths } from "./rebuild-runner";
import { TASK_PHASE_VALUES } from "./types"; // Assuming it's in types.ts


/**
 * Run the rebuild command for a project.
 */
export async function runRebuild(project: WikiProject): Promise<void> {
	return runRebuildWithRunner(project, defaultRebuildRunner);
}

/**
 * Rebuild the project and summarize the current state.
 */
export async function rebuildAndSummarize(
	project: WikiProject,
): Promise<{ text: string; issueCount: number; report: LintReport }> {
	await runRebuild(project);
	const report = await readJson<LintReport>(project.lintPath);
	const kinds = Object.entries(report.counts)
		.map(([kind, count]) => `${kind}=${count}`)
		.join(" ");
	return {
		text: `${project.label}: ${report.issues.length} issue(s) (${kinds})`,
		issueCount: report.issues.length,
		report,
	};
}

/**
 * Run the rebuild command without locking (caller must lock).
 */
export async function runRebuildUnlocked(project: WikiProject): Promise<void> {
	return runRebuildUnlockedWithRunner(project, defaultRebuildRunner);
}

const defaultRebuildRunner: CoreRebuildRunner = {
	run: async (project) => {
		const { runConfiguredOrDefaultRebuild } = await import("../infrastructure/rebuild-runner");
		await runConfiguredOrDefaultRebuild(project);
	},
};

/**
 * Load all core state artifacts, optionally refreshing them first.
 */
export async function loadCodewikiStateArtifacts(
	project: WikiProject,
	refresh: boolean,
): Promise<{
	refreshPerformed: boolean;
	report: LintReport | null;
	statusState: StatusStateFile | null;
	roadmapState: RoadmapStateFile | null;
	graph: GraphFile | null;
}> {
	let refreshPerformed = false;
	if (refresh) {
		await runRebuild(project);
		refreshPerformed = true;
	}
	let report = await maybeReadJson<LintReport>(project.lintPath);
	let statusState = await maybeReadStatusState(project.statusStatePath);
	let roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
	let graph = await maybeReadJson<GraphFile>(project.graphPath);
	
	if (!report || !statusState || !roadmapState || !graph) {
		if (!refreshPerformed) {
			await runRebuild(project);
			refreshPerformed = true;
			report = await maybeReadJson<LintReport>(project.lintPath);
			statusState = await maybeReadStatusState(project.statusStatePath);
			roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
			graph = await maybeReadJson<GraphFile>(project.graphPath);
		}
	}
	return { refreshPerformed, report, statusState, roadmapState, graph };
}

export async function maybeReadStatusState(path: string): Promise<StatusStateFile | null> {
	return maybeReadJson<StatusStateFile>(path);
}

export async function maybeReadRoadmapState(path: string): Promise<RoadmapStateFile | null> {
	return maybeReadJson<RoadmapStateFile>(path);
}

export async function maybeReadGraph(path: string): Promise<GraphFile | null> {
	return maybeReadJson<GraphFile>(path);
}

/**
 * Normalize a task phase string or return null if invalid.
 */
export function normalizeTaskPhaseOrNull(
	value: string | null | undefined,
): TaskPhase | null {
	if (!value) return null;
	return (TASK_PHASE_VALUES as readonly string[]).includes(value)
		? (value as TaskPhase)
		: null;
}

/**
 * Determine the API status and phase for a roadmap task.
 */
export function roadmapApiTaskState(
	task: { status: RoadmapStatus },
	runtimeTask?: RoadmapStateTaskSummary | null,
): { status: ToolTaskStatus; phase: TaskPhase | null } {
	if (task.status === "todo") return { status: "todo", phase: null };
	if (task.status === "blocked") return { status: "blocked", phase: null };
	if (task.status === "done") return { status: "done", phase: null };
	if (task.status === "cancelled") return { status: "cancelled", phase: null };
	if (task.status === "in_progress") {
		return {
			status: "in_progress",
			phase: normalizeTaskPhaseOrNull(runtimeTask?.loop?.phase),
		};
	}
	return {
		status: "in_progress",
		phase: normalizeTaskPhaseOrNull(task.status),
	};
}

/**
 * Map tool task status and phase back to a roadmap status.
 */
export function mapToolTaskStatusToRoadmapStatus(
	status: ToolTaskStatus,
	phase: TaskPhase | null,
): RoadmapStatus {
	switch (status) {
		case "todo":
			return "todo";
		case "blocked":
			return "blocked";
		case "done":
			return "done";
		case "cancelled":
			return "cancelled";
		case "in_progress":
			return phase ?? "in_progress";
	}
}

/**
 * Resolve the path to a task context file.
 */
export function resolveTaskContextPath(
	project: WikiProject,
	taskId: string,
	runtimeTask?: RoadmapStateTaskSummary | null,
): string {
	const relative =
		runtimeTask?.context_path || `.wiki/roadmap/tasks/${taskId}/context.json`;
	return resolve(project.root, relative);
}

/**
 * Read the task context packet if it exists.
 */
export async function maybeReadTaskContext(
	project: WikiProject,
	taskId: string,
	runtimeTask?: RoadmapStateTaskSummary | null,
): Promise<RoadmapTaskContextPacket | null> {
	return maybeReadJson<RoadmapTaskContextPacket>(
		resolveTaskContextPath(project, taskId, runtimeTask),
	);
}

