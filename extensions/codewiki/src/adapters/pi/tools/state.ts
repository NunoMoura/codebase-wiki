import type {
	WikiProject,
	CodewikiStateToolInput,
	RoadmapStateFile,
	StatusStateFile,
	TaskSessionLinkRecord,
	RoadmapTaskRecord,
	RoadmapTaskContextPacket,
	RoadmapStateTaskSummary,
	CodewikiStateSection,
} from "../../../core/types";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { codewikiStateToolInputSchema } from "../../../core/schemas";
import { loadCodewikiStateArtifacts, roadmapApiTaskState, maybeReadTaskContext } from "../../../core/state";
import { currentTaskLink } from "../../../core/session";
import { readRoadmapTask } from "../../../core/roadmap";
import { resolveToolProject } from "../../../core/project";
import { refreshStatusDock } from "../ui/manager";

/**
 * Register the codewiki_state tool.
 */
export function registerCodewikiStateTool(pi: any) {
	pi.registerTool({
		name: "codewiki_state",
		label: "Codewiki State",
		description:
			"Read graph-first codewiki state, optionally rebuild derived files, and return a structured repo/task/session snapshot",
		promptSnippet:
			"Inspect graph-first codewiki state through one structured read entrypoint",
		promptGuidelines: [
			"Use this as primary agent read tool for repo resolution, health, roadmap summary, focused session, and next-step guidance.",
			"Set refresh=true when derived graph/state files may be stale or missing.",
		],
		parameters: codewikiStateToolInputSchema,
		async execute(_toolCallId: string, params: CodewikiStateToolInput, _signal: any, _onUpdate: any, ctx: ExtensionContext) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_state",
			);
			const result = await readCodewikiState(project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [
					{ type: "text", text: formatCodewikiStateSummary(project, result) },
				],
				details: result,
			};
		},
	});
}

export function buildCodewikiStateInclude(
	include: string[] | undefined,
	taskId: string | undefined,
): CodewikiStateSection[] {
	const base = include?.length ? include : ["repo", "health", "summary"];
	const sections = new Set(base);
	if (taskId) sections.add("task");
	return Array.from(sections) as CodewikiStateSection[];
}

export async function readCodewikiState(
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiStateToolInput,
) {
	
	const include = buildCodewikiStateInclude(input.include, input.taskId);
	const artifacts = await loadCodewikiStateArtifacts(
		project,
		input.refresh ?? false,
	);
	const activeLink = currentTaskLink(ctx);
	const health = artifacts.statusState?.health ?? {
		color: (artifacts.report?.issues.length ?? 0) > 0 ? "yellow" : "green",
		errors: 0,
		warnings: artifacts.report?.issues.length ?? 0,
		total_issues: artifacts.report?.issues.length ?? 0,
	};
	const nextAction = buildCodewikiNextAction(
		artifacts.statusState,
		artifacts.roadmapState,
		activeLink,
	);
	const result: Record<string, unknown> = {
		repo: {
			repo_root: project.root,
			wiki_root: project.docsRoot,
			resolved_from: input.repoPath?.trim() || project.root,
			contract_version: String(
				artifacts.graph?.version ?? artifacts.statusState?.version ?? 0,
			),
			refresh_performed: artifacts.refreshPerformed,
		},
		health,
		summary: {
			open_task_count: artifacts.statusState?.summary.open_task_count ?? 0,
			active_task_ids: artifacts.roadmapState?.views.in_progress_task_ids ?? [],
			blocked_task_ids: artifacts.roadmapState?.views.blocked_task_ids ?? [],
			next_task_id: nextAction.taskId ?? null,
			unmapped_spec_count: artifacts.statusState?.summary.unmapped_specs ?? 0,
		},
		next_action: nextAction,
	};
	if (include.includes("roadmap")) {
		result.roadmap = {
			ordered_open_task_ids: artifacts.roadmapState?.views.open_task_ids ?? [],
			active_task_ids: artifacts.roadmapState?.views.in_progress_task_ids ?? [],
			blocked_task_ids: artifacts.roadmapState?.views.blocked_task_ids ?? [],
			recent_task_ids: artifacts.roadmapState?.views.recent_task_ids ?? [],
		};
	}
	if (include.includes("graph")) {
		const graph = artifacts.graph;
		result.graph = {
			generated_at: graph?.generated_at ?? null,
			node_count: graph?.nodes.length ?? 0,
			edge_count: graph?.edges.length ?? 0,
			doc_count: graph?.nodes.filter((node) => node.kind === "doc").length ?? 0,
			code_path_count:
				graph?.nodes.filter((node) => node.kind === "code_path").length ?? 0,
			source: "graph",
		};
	}
	if (include.includes("drift")) {
		result.drift = {
			tracked_spec_count: artifacts.statusState?.summary.tracked_specs ?? 0,
			untracked_spec_count: artifacts.statusState?.summary.untracked_specs ?? 0,
			blocked_spec_count: artifacts.statusState?.summary.blocked_specs ?? 0,
			high_risk_spec_paths:
				artifacts.statusState?.views.top_risky_spec_paths ?? [],
		};
	}
	if (include.includes("session")) {
		result.session = {
			focused_task_id:
				activeLink?.action === "clear" ? null : (activeLink?.taskId ?? null),
			updated_at: activeLink?.timestamp ?? null,
			summary: activeLink?.summary || null,
		};
	}
	if (include.includes("task")) {
		if (!input.taskId) {
			result.task = null;
		} else {
			const task = await readRoadmapTask(project, input.taskId);
			if (!task) throw new Error(`Roadmap task not found: ${input.taskId}`);
			const runtimeTask = artifacts.roadmapState?.tasks?.[task.id] ?? null;
			const contextPacket = await maybeReadTaskContext(
				project,
				task.id,
				runtimeTask,
			);
			result.task = buildCodewikiTaskDetail(task, runtimeTask, contextPacket);
		}
	}
	return result;
}

export function buildCodewikiNextAction(
	statusState: StatusStateFile | null,
	roadmapState: RoadmapStateFile | null,
	activeLink: TaskSessionLinkRecord | null,
) {
	if (activeLink && activeLink.action !== "clear") {
		return {
			kind: "resume",
			taskId: activeLink.taskId,
			reason: "Active task focus detected in session.",
		};
	}
	const nextTaskId = roadmapState?.views.open_task_ids?.[0];
	if (nextTaskId) {
		return {
			kind: "next_task",
			taskId: nextTaskId,
			reason: "Roadmap has open tasks.",
		};
	}
	if ((statusState?.summary.untracked_specs ?? 0) > 0) {
		return {
			kind: "wiki_drift",
			taskId: null,
			reason: "Wiki drift exists without an open roadmap task.",
		};
	}
	return {
		kind: "none",
		taskId: null,
		reason: "No open roadmap task or urgent wiki drift signal detected.",
	};
}

export function buildCodewikiTaskDetail(
	task: RoadmapTaskRecord,
	runtimeTask: RoadmapStateTaskSummary | null,
	contextPacket: RoadmapTaskContextPacket | null,
) {
	const apiState = roadmapApiTaskState(task, runtimeTask);
	const evidence = runtimeTask?.loop?.evidence ?? null;
	const contextPath =
		runtimeTask?.context_path ?? `.wiki/roadmap/tasks/${task.id}/context.json`;
	const enrichedContextPacket = {
		version: contextPacket?.version ?? 1,
		generated_at: contextPacket?.generated_at ?? task.updated,
		context_path: contextPacket?.context_path ?? contextPath,
		...(contextPacket ?? {}),
		task: {
			id: task.id,
			title: task.title,
			status: apiState.status,
			phase: apiState.phase,
			priority: task.priority,
			kind: task.kind,
			summary: task.summary,
			labels: task.labels,
			goal: task.goal,
			delta: task.delta,
			...(contextPacket?.task ?? {}),
		},
	};
	return {
		id: task.id,
		title: task.title,
		status: apiState.status,
		phase: apiState.phase,
		priority: task.priority,
		kind: task.kind,
		summary: task.summary,
		labels: task.labels,
		spec_paths: task.spec_paths,
		code_paths: task.code_paths,
		research_ids: task.research_ids,
		goal: task.goal,
		delta: task.delta,
		context_path: contextPath,
		context_packet: enrichedContextPacket,
		latest_evidence: evidence
			? {
					result: evidence.verdict,
					summary: evidence.summary,
				}
			: null,
		updated: task.updated,
	};
}

export function formatCodewikiStateSummary(
	project: WikiProject,
	result: any,
): string {
	const repo = result.repo;
	const summary = result.summary;
	const health = result.health;
	const session = result.session;
	const nextAction = result.next_action;

	const parts = [
		`Codewiki State: ${project.label} [${repo.contract_version}]`,
		`Health: ${health.color} (${health.errors} errors, ${health.warnings} warnings)`,
		`Roadmap: open ${summary.open_task_count}; next ${nextAction.taskId ?? "none"}; unmapped ${summary.unmapped_spec_count}`,
	];

	if (session?.focused_task_id) {
		parts.push(`Session: focusing on ${session.focused_task_id}`);
	}

	parts.push(`Next Action [${nextAction.kind}]: ${nextAction.reason}`);
	if (nextAction.taskId) parts.push(`Suggested task: ${nextAction.taskId}`);

	return parts.join("\n");
}
