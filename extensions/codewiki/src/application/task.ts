/**
 * application/task.ts
 *
 * Task mutation use cases — create, update, close, append evidence.
 * Orchestrates roadmap task mutation helpers behind port interfaces.
 */
import type { WikiProject, RoadmapTaskRecord, RoadmapTaskInput, CodewikiTaskPatchInput, CodewikiTaskEvidenceInput, RoadmapStatus } from "../domain/shared/types.ts";
import { appendRoadmapTasks, updateRoadmapTask, appendCodewikiTaskEvidence, readRoadmapTask, hasCodewikiTaskPatchChanges, buildRoadmapTaskUpdateFromCodewikiPatch, hasRoadmapTaskUpdateFields } from "./roadmap.ts";
import { maybeReadRoadmapState } from "./state-artifacts.ts";
import type { FileStore, RebuildRunner, MessageBus } from "./ports.ts";

// ---------------------------------------------------------------------------
// Port dependencies
// ---------------------------------------------------------------------------

export interface TaskMutationPorts {
	fileStore: FileStore;
	rebuildRunner: RebuildRunner;
	messageBus: MessageBus;
}

// ---------------------------------------------------------------------------
// Create tasks
// ---------------------------------------------------------------------------

export async function createCodewikiTasks(
	project: WikiProject,
	inputs: RoadmapTaskInput[],
	ports: TaskMutationPorts,
): Promise<{ created: RoadmapTaskRecord[]; reused: RoadmapTaskRecord[]; refined: RoadmapTaskRecord[] }> {
	const result = await appendRoadmapTasks(null as any, project, null as any, inputs, { refresh: false });
	await ports.rebuildRunner.run(project);
	return result;
}

// ---------------------------------------------------------------------------
// Update task (patch-style from codewiki_task tool)
// ---------------------------------------------------------------------------

export async function patchCodewikiTask(
	project: WikiProject,
	taskId: string,
	patch: CodewikiTaskPatchInput,
	ports: TaskMutationPorts,
): Promise<{ task: RoadmapTaskRecord; changed: boolean }> {
	const task = await readRoadmapTask(project, taskId);
	if (!task) throw new Error(`Roadmap task not found: ${taskId}`);

	const state = await maybeReadRoadmapState(project.roadmapStatePath);
	const runtimeTask = state?.tasks?.[task.id] ?? null;

	if (!hasCodewikiTaskPatchChanges(patch)) {
		return { task, changed: false };
	}

	const update = buildRoadmapTaskUpdateFromCodewikiPatch(task, runtimeTask, patch);

	if (!hasRoadmapTaskUpdateFields(update)) {
		return { task, changed: false };
	}

	const result = await updateRoadmapTask(project, update, { refresh: false });
	if (result.changed) await ports.rebuildRunner.run(project);
	return result;
}

// ---------------------------------------------------------------------------
// Close task with verification gateway
// ---------------------------------------------------------------------------

export async function closeCodewikiTask(
	project: WikiProject,
	taskId: string,
	ports: TaskMutationPorts,
	evidence?: CodewikiTaskEvidenceInput,
	summary?: string,
): Promise<{
	closed: boolean;
	verification: any;
	reason: string;
}> {
	const task = await readRoadmapTask(project, taskId);
	if (!task) throw new Error(`Roadmap task not found: ${taskId}`);

	// Deprecated automatic verifier removed during DDD refactor.
	// The validation gateway now owns loop-exit and task-close decisions
	// independently, not baked into the close path.
	// See: .codewiki/kb/system/validation-gateway.md

	// Close the task
	await updateRoadmapTask(project, {
		taskId: task.id,
		status: "done",
		summary: summary?.trim() || evidence?.summary?.trim() || "Task closed.",
	}, { refresh: false });

	await ports.rebuildRunner.run(project);

	return {
		closed: true,
		verification: null,
		reason: "Task closed.",
	};
}

// ---------------------------------------------------------------------------
// Append evidence
// ---------------------------------------------------------------------------

export async function appendTaskEvidence(
	project: WikiProject,
	taskId: string,
	evidence: CodewikiTaskEvidenceInput,
	ports: TaskMutationPorts,
): Promise<void> {
	const task = await readRoadmapTask(project, taskId);
	if (!task) throw new Error(`Roadmap task not found: ${taskId}`);
	await appendCodewikiTaskEvidence(project, task, evidence, false);
	await ports.rebuildRunner.run(project);
}

// ---------------------------------------------------------------------------
// Cancel task
// ---------------------------------------------------------------------------

export async function cancelCodewikiTask(
	project: WikiProject,
	taskId: string,
	ports: TaskMutationPorts,
	summary?: string,
): Promise<void> {
	const task = await readRoadmapTask(project, taskId);
	if (!task) throw new Error(`Roadmap task not found: ${taskId}`);

	await updateRoadmapTask(project, {
		taskId: task.id,
		status: "cancelled" as RoadmapStatus,
		summary: summary ?? task.summary,
	}, { refresh: false });
	await ports.rebuildRunner.run(project);
}
