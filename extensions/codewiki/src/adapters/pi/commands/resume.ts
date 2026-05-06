import { resolve } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import {
	resolveCommandProject,
} from "../../../core/project";
import {
	withUiErrorHandling,
	refreshStatusDock,
    queueAudit,
} from "../ui/manager";
import { 
    maybeReadRoadmapState, 
    maybeReadGraph,
    maybeReadTaskContext,
    rebuildAndSummarize,
    runRebuild
} from "../../../core/state";
import {
	readRoadmapTask,
	readRoadmapFile,
    taskLoopPhase,
    taskLoopEvidenceLine,
    updateRoadmapTask,
    appendTaskPhaseEvent,
    isRoadmapTaskToken,
    resolveRoadmapTask,
    isClosedRoadmapStatus,
    isActiveLoopRoadmapStatus,
} from "../../../core/roadmap";
import { 
    currentTaskLink, 
    linkTaskSession 
} from "../../../core/session";
import { 
    splitCommandArgs, 
    joinCommandArgs,
    nowIso
} from "../../../core/utils";
import { 
    normalizeTaskPhaseValue,
    phaseLabel,
    statusColor,
    statusLevel
} from "../ui/theme";
import { codePrompt } from "../../../core/prompt";
import type { 
    RoadmapFile, 
    RoadmapTaskRecord, 
    TaskSessionLinkRecord,
    RoadmapStatus,
    TaskSessionAction
} from "../../../core/types";

/**
 * Register the wiki-resume command.
 */
export function registerResumeCommand(pi: ExtensionAPI): void {
	pi.registerCommand(`wiki-resume`, {
		description:
			"Resume roadmap work from current task focus or next open task. Usage: /wiki-resume [TASK-###] [repo-path]",
		handler: async (args, ctx) => {
			await withUiErrorHandling(ctx, async () => {
				await runResumeCommand(pi, "wiki-resume", args, ctx);
			});
		},
	});
}

async function runResumeCommand(
	pi: ExtensionAPI,
	commandName: "wiki-resume",
	args: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const { requestedTaskId, pathArg } = normalizeCodeArgs(args);
	const project = await resolveCommandProject(ctx, pathArg, commandName);
	const summary = await rebuildAndSummarize(project);
	const graph = await maybeReadGraph(project.graphPath);
	const roadmap = await readRoadmapFile(
		resolve(project.root, project.roadmapPath),
	);
	const task = resolveImplementationTask(
		roadmap,
		currentTaskLink(ctx),
		requestedTaskId,
	);
	if (!task) {
		ctx.ui.notify(
			`${project.label}: no open roadmap task available for /${commandName}. Open /wiki-status or use Alt+W if you need a different direction.`,
			"warning",
		);
		await refreshStatusDock(project, ctx, currentTaskLink(ctx));
		return;
	}
	let resumedTask = task;
	let roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
	let runtimeTask = roadmapState?.tasks?.[task.id] ?? null;
	const initialPhase = taskLoopPhase(runtimeTask);
	const desiredStatus: RoadmapStatus =
		task.status === "todo" || task.status === "research"
			? "implement"
			: task.status === "in_progress" || task.status === "blocked"
				? (normalizeTaskPhaseValue(initialPhase, "implement") as RoadmapStatus)
				: task.status;
	if (desiredStatus !== task.status) {
		resumedTask = (
			await updateRoadmapTask(project, {
				taskId: task.id,
				status: desiredStatus,
			})
		).task;
		roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
		runtimeTask = roadmapState?.tasks?.[task.id] ?? null;
	}
	const selectionReason = describeResumeSelection(
		roadmap,
		currentTaskLink(ctx),
		requestedTaskId,
		resumedTask,
	);
	const action: TaskSessionAction = "progress";
	const sessionSummary = `Resumed roadmap work on ${resumedTask.id} through /${commandName}.`;
	await linkTaskSession(pi, project, ctx, {
		taskId: resumedTask.id,
		action,
		summary: sessionSummary,
		setSessionName: false,
	});
	const activeLink: TaskSessionLinkRecord = {
		taskId: resumedTask.id,
		action,
		summary: sessionSummary,
		filesTouched: [],
		spawnedTaskIds: [],
		timestamp: nowIso(),
	};
	const phase = taskLoopPhase(runtimeTask);
	const evidence = taskLoopEvidenceLine(runtimeTask);
	await appendTaskPhaseEvent(
		project,
		resumedTask,
		"task_phase_started",
		phase,
		{
			summary: `Queued ${phaseLabel(phase)} through /${commandName}.`,
		},
	);
	await runRebuild(project);
	const refreshedRoadmapState = await maybeReadRoadmapState(
		project.roadmapStatePath,
	);
	const refreshedRuntimeTask =
		refreshedRoadmapState?.tasks?.[resumedTask.id] ?? null;
	const taskContext = await maybeReadTaskContext(
		project,
		resumedTask.id,
		refreshedRuntimeTask,
	);
	const refreshedGraph = (await maybeReadGraph(project.graphPath)) ?? graph;
	ctx.ui.notify(
		`${project.label}: queued ${phase} for ${resumedTask.id} — ${resumedTask.title}. ${selectionReason} Deterministic preflight is ${statusColor(summary.report)}.`,
		statusLevel(summary.report),
	);
	await refreshStatusDock(project, ctx, activeLink);
	await queueAudit(
		pi,
		ctx,
		codePrompt(
			project,
			refreshedGraph,
			summary.report,
			resumedTask,
			phase,
			evidence,
			taskContext,
		),
	);
}

function normalizeCodeArgs(args: string): {
	requestedTaskId: string | null;
	pathArg: string | null;
} {
	const tokens = splitCommandArgs(args);
	if (tokens.length === 0) return { requestedTaskId: null, pathArg: null };

	const first = tokens[0];
	const last = tokens[tokens.length - 1];
	if (isRoadmapTaskToken(first)) {
		return {
			requestedTaskId: first,
			pathArg: joinCommandArgs(tokens.slice(1)),
		};
	}
	if (tokens.length > 1 && isRoadmapTaskToken(last)) {
		return {
			requestedTaskId: last,
			pathArg: joinCommandArgs(tokens.slice(0, -1)),
		};
	}
	return { requestedTaskId: null, pathArg: joinCommandArgs(tokens) };
}

function resolveImplementationTask(
	roadmap: RoadmapFile,
	activeLink: TaskSessionLinkRecord | null,
	requestedTaskId: string | null,
): RoadmapTaskRecord | null {
	const ordered = roadmap.order
		.map((taskId) => roadmap.tasks[taskId])
		.filter((task): task is RoadmapTaskRecord => Boolean(task));
	const activeTask = activeLink
		? resolveRoadmapTask(roadmap, activeLink.taskId)
		: null;
	const linkedActiveLoopTask =
		activeTask && isActiveLoopRoadmapStatus(activeTask.status)
			? activeTask
			: null;
	const activeWorkTask =
		linkedActiveLoopTask ??
		ordered.find((task) => isActiveLoopRoadmapStatus(task.status));

	if (requestedTaskId) {
		const requestedTask = resolveRoadmapTask(roadmap, requestedTaskId);
		if (!requestedTask)
			throw new Error(`Roadmap task not found: ${requestedTaskId}`);
		if (isClosedRoadmapStatus(requestedTask.status))
			throw new Error(`Roadmap task already closed: ${requestedTask.id}`);
		if (
			requestedTask.status === "todo" &&
			activeWorkTask &&
			activeWorkTask.id !== requestedTask.id
		) {
			throw new Error(
				`Roadmap task ${requestedTask.id} cannot start yet. ${activeWorkTask.id} is still active in ${activeWorkTask.status}; resume or finish active loop work first.`,
			);
		}
		return requestedTask;
	}

	if (activeWorkTask) return activeWorkTask;
	if (activeTask && !isClosedRoadmapStatus(activeTask.status))
		return activeTask;
	const todoTask = ordered.find((task) => task.status === "todo");
	if (todoTask) return todoTask;
	return null;
}

function describeResumeSelection(
	roadmap: RoadmapFile,
	activeLink: TaskSessionLinkRecord | null,
	requestedTaskId: string | null,
	task: RoadmapTaskRecord,
): string {
	if (requestedTaskId) return `User requested ${task.id} explicitly.`;
	const ordered = roadmap.order
		.map((taskId) => roadmap.tasks[taskId])
		.filter((item): item is RoadmapTaskRecord => Boolean(item));
	const activeTask = activeLink
		? resolveRoadmapTask(roadmap, activeLink.taskId)
		: null;
	const hasOtherTodo = ordered.some(
		(item) => item.status === "todo" && item.id !== task.id,
	);
	if (activeTask?.id === task.id && isActiveLoopRoadmapStatus(task.status)) {
		return hasOtherTodo
			? `Continuing session-focused ${task.status} work before opening next todo task.`
			: `Continuing session-focused ${task.status} work.`;
	}
	if (isActiveLoopRoadmapStatus(task.status)) {
		return hasOtherTodo
			? `Continuing active ${task.status} work before opening next todo task.`
			: `Continuing active ${task.status} work.`;
	}
	return task.status === "todo"
		? "No active loop work found; starting next todo task in implement."
		: `Continuing ${task.status} work.`;
}
