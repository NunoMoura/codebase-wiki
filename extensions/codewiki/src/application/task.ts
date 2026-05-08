/**
 * application/task.ts
 *
 * Task mutation use cases — create, update, close, append evidence.
 * Orchestrates core/roadmap.ts domain logic behind port interfaces.
 */
import type { WikiProject, RoadmapTaskRecord, RoadmapTaskInput, CodewikiTaskPatchInput, CodewikiTaskEvidenceInput, RoadmapTaskUpdateInput, RoadmapStatus } from "../domain/shared/types";
import { appendRoadmapTasks, updateRoadmapTask, appendCodewikiTaskEvidence, readRoadmapTask, maybeRunAutomaticTaskVerifier, hasCodewikiTaskPatchChanges, buildRoadmapTaskUpdateFromCodewikiPatch, updateTaskLoop, hasRoadmapTaskUpdateFields, summarizeCodewikiTaskAction, type SemanticTaskVerifierRunner } from "../core/roadmap";
import { maybeReadRoadmapState, roadmapApiTaskState, mapToolTaskStatusToRoadmapStatus, runRebuild } from "../core/state";
import type { FileStore, RebuildRunner, MessageBus } from "./ports";

// ---------------------------------------------------------------------------
// Port dependencies
// ---------------------------------------------------------------------------

export interface TaskMutationPorts {
	fileStore: FileStore;
	rebuildRunner: RebuildRunner;
	messageBus: MessageBus;
	runSemanticVerifier?: SemanticTaskVerifierRunner;
}

// ---------------------------------------------------------------------------
// Create tasks
// ---------------------------------------------------------------------------

export async function createCodewikiTasks(
	project: WikiProject,
	inputs: RoadmapTaskInput[],
	ports: TaskMutationPorts,
): Promise<{ created: RoadmapTaskRecord[]; reused: RoadmapTaskRecord[] }> {
	const result = await appendRoadmapTasks(null as any, project, null as any, inputs);
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

	if (hasRoadmapTaskUpdateFields(update)) {
		return updateRoadmapTask(project, update);
	}
	return { task, changed: false };
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

	if (ports.runSemanticVerifier) {
		const verifierResult = await maybeRunAutomaticTaskVerifier(
			project,
			task,
			ports.runSemanticVerifier,
			evidence,
		);
		if (verifierResult) {
			if (verifierResult.verdict === "fail") {
				return {
					closed: false,
					verification: verifierResult,
					reason: "Task close blocked by automatic verifier (fail).",
				};
			}
			if (verifierResult.verdict === "block") {
				return {
					closed: false,
					verification: verifierResult,
					reason: "Task close blocked by automatic verifier (block).",
				};
			}
		}
	}

	// Close the task
	await updateRoadmapTask(project, {
		taskId: task.id,
		status: "done",
		summary: summary?.trim() || evidence?.summary?.trim() || "Task closed.",
	});

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
	await appendCodewikiTaskEvidence(project, task, evidence);
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
	});
	await ports.rebuildRunner.run(project);
}