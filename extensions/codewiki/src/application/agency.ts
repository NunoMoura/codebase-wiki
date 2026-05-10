/**
 * application/agency.ts
 *
 * "Run agency planning" use case.
 * Plans the next bounded agency action from roadmap state, graph cues, and trigger.
 */
import type { WikiProject, AgencyMode, AgencyTrigger, AgencyBudget } from "../domain/shared/types.ts";
import { readCodewikiState } from "./state.ts";
import type { ReadStatePorts } from "./state.ts";
import type { FileStore, RebuildRunner } from "./ports.ts";

// ---------------------------------------------------------------------------
// Port dependencies
// ---------------------------------------------------------------------------

export interface AgencyPorts extends ReadStatePorts {
	fileStore: FileStore;
	rebuildRunner: RebuildRunner;
}

// ---------------------------------------------------------------------------
// Budget presets
// ---------------------------------------------------------------------------

function budgetForMode(mode: AgencyMode, trigger: AgencyTrigger): AgencyBudget {
	switch (mode) {
		case "observe":
			return { maxWrites: 0, maxCycles: 1, maxWallSeconds: 30, risk: "low" };
		case "maintain":
			return { maxWrites: 12, maxCycles: 3, maxWallSeconds: 300, risk: "medium" };
		case "work": {
			if (trigger === "roadmap_end") return { maxWrites: 24, maxCycles: 4, maxWallSeconds: 600, risk: "medium" };
			if (trigger === "sprint_end") return { maxWrites: 16, maxCycles: 3, maxWallSeconds: 480, risk: "medium" };
			return { maxWrites: 8, maxCycles: 2, maxWallSeconds: 240, risk: "medium" };
		}
		default:
			return { maxWrites: 12, maxCycles: 3, maxWallSeconds: 300, risk: "medium" };
	}
}

function resolveModeAndTrigger(
	inputMode?: AgencyMode,
	inputTrigger?: AgencyTrigger,
): { mode: AgencyMode; trigger: AgencyTrigger } {
	const trigger = inputTrigger ?? "manual";
	if (inputMode) return { mode: inputMode, trigger };
	switch (trigger) {
		case "task_end":
			return { mode: "work", trigger };
		case "sprint_end":
			return { mode: "work", trigger };
		case "roadmap_end":
			return { mode: "maintain", trigger };
		case "budget_end":
			return { mode: "observe", trigger };
		default:
			return { mode: "observe", trigger };
	}
}

// ---------------------------------------------------------------------------
// Plan next agency action
// ---------------------------------------------------------------------------

export async function planAgency(
	project: WikiProject,
	opts: {
		mode?: AgencyMode;
		trigger?: AgencyTrigger;
		dryRun: boolean;
		budget?: Partial<AgencyBudget>;
	},
	ports: AgencyPorts,
): Promise<{
	summary: string;
	mode: AgencyMode;
	trigger: AgencyTrigger;
	budget: AgencyBudget;
	cycles: Array<Record<string, unknown>>;
	stop: Record<string, unknown>;
	policy: Record<string, unknown>;
	bounded_context: Record<string, unknown>;
}> {
	const resolved = resolveModeAndTrigger(opts.mode, opts.trigger);
	const mode = resolved.mode;
	const trigger = resolved.trigger;
	const base = budgetForMode(mode, trigger);
	const budget: AgencyBudget = opts.budget ? { ...base, ...opts.budget } : base;
	const dryRun = opts.dryRun ?? true;

	const state = await readCodewikiState(project, {
		include: ["summary", "roadmap", "drift", "session"],
		refresh: mode !== "observe" && (budget.maxWrites ?? 0) > 0 && !dryRun,
		taskId: undefined,
	}, ports);

	const health = state.health as Record<string, unknown> | undefined;
	const summaryState = state.summary as Record<string, unknown> | undefined;
	const roadmap = state.roadmap as Record<string, unknown> | undefined;
	const openTasks = (Array.isArray(roadmap?.ordered_open_task_ids)
		? roadmap.ordered_open_task_ids
		: []) as string[];
	const nextTask: string | null = openTasks[0] ?? null;

	const needsViewRefresh = Boolean(
		((health?.total_issues as number | undefined) ?? 0) ||
		((summaryState?.unmapped_spec_count as number | undefined) ?? 0),
	);

	// Build trigger-aware action plan
	const cycles: Array<Record<string, unknown>> = [];
	const stop: Record<string, unknown> = { condition: "", reason: "", completed: false };

	if (mode === "observe") {
		cycles.push({
			cycle: 1,
			action: "report",
			summary: trigger === "budget_end"
				? "Budget exhausted. Reporting current state for handoff."
				: `Reporting CodeWiki state (trigger: ${trigger}).`,
			next_task: nextTask,
			open_tasks: openTasks,
		});
		stop.condition = "Observation complete.";
		stop.reason = "Observe mode — no writes permitted.";
	} else if (mode === "maintain") {
		if (needsViewRefresh) {
			cycles.push({
				cycle: 1,
				action: "refresh_views",
				summary: "Graph/views stale or lint issues present. Rebuild needed.",
			});
		} else if (trigger === "roadmap_end") {
			cycles.push({
				cycle: 1,
				action: "audit_roadmap",
				summary: "Roadmap-end trigger: audit open tasks for relevance, suggest cancellation or sprint planning.",
				open_tasks: openTasks,
			});
		} else {
			cycles.push({
				cycle: 1,
				action: "audit_graph",
				summary: "Running graph/validation audit.",
			});
		}
		stop.condition = "Maintenance complete.";
		stop.reason = "Maintain mode budget reached.";
	} else {
		// work mode
		if (!nextTask) {
			cycles.push({
				cycle: 1,
				action: "report",
				summary: trigger === "task_end"
					? "No open tasks remaining. Roadmap is clear."
					: "No open tasks. Nothing to plan.",
			});
			stop.condition = "No open tasks.";
			stop.reason = "Roadmap empty.";
			stop.completed = true;
		} else {
			cycles.push({
				cycle: 1,
				action: trigger === "sprint_end" ? "sprint_review" : "task_advance",
				summary: trigger === "sprint_end"
					? `Sprint-end trigger: consider sprint review and checkpoint. Next: ${nextTask}.`
					: `Next task: ${nextTask}. Load roadmap item, linked builds, and specs; execute implementation loop.`,
				next_task: nextTask,
				open_tasks: openTasks,
				recommended_next_loop: trigger === "sprint_end" ? "documentation" : "implementation",
			});
			stop.condition = "Work cycle planned.";
			stop.reason = dryRun ? "Dry-run — no execution." : "Ready for execution.";
			stop.next_task = nextTask;
		}
	}

	return {
		summary: `Agency [${trigger}]: ${mode} mode. ${cycles[0]?.summary ?? "No action."}`,
		mode,
		trigger,
		budget,
		cycles,
		stop,
		policy: {
			risk: budget.risk ?? "low",
			allowWrites: (budget.maxWrites ?? 0) > 0 && !dryRun,
			maxWrites: budget.maxWrites ?? 0,
			maxCycles: budget.maxCycles ?? 1,
			trigger,
		},
		bounded_context: {
			token_budget: budget.maxCycles ?? 1,
			mode,
			trigger,
			next_task: nextTask,
			action: cycles[0]?.action ?? "none",
		},
	};
}