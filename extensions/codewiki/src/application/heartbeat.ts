/**
 * application/heartbeat.ts
 *
 * "Run heartbeat planning" use case.
 * Selects the next bounded action from a plan-only loop.
 */
import type { WikiProject, HeartbeatMode, HeartbeatBudget } from "../domain/shared/types.ts";
import { readCodewikiState } from "./state.ts";
import type { ReadStatePorts } from "./state.ts";
import type { FileStore, RebuildRunner } from "./ports.ts";

// ---------------------------------------------------------------------------
// Port dependencies
// ---------------------------------------------------------------------------

export interface HeartbeatPorts extends ReadStatePorts {
	fileStore: FileStore;
	rebuildRunner: RebuildRunner;
}

// ---------------------------------------------------------------------------
// Budget presets
// ---------------------------------------------------------------------------

function budgetForMode(mode: HeartbeatMode): HeartbeatBudget {
	switch (mode) {
		case "observe":
			return { maxWrites: 0, maxCycles: 1, maxWallSeconds: 30, risk: "low" };
		case "maintain":
			return { maxWrites: 12, maxCycles: 3, maxWallSeconds: 300, risk: "medium" };
		default:
			return { maxWrites: 12, maxCycles: 3, maxWallSeconds: 300, risk: "medium" };
	}
}

function mergeBudget(mode: HeartbeatMode, input?: { budget?: Partial<HeartbeatBudget> }): HeartbeatBudget {
	const base = budgetForMode(mode);
	if (!input?.budget) return base;
	return {
		maxWrites: input.budget.maxWrites ?? base.maxWrites,
		maxCycles: input.budget.maxCycles ?? base.maxCycles,
		maxWallSeconds: input.budget.maxWallSeconds ?? base.maxWallSeconds,
		risk: input.budget.risk ?? base.risk,
	};
}

// ---------------------------------------------------------------------------
// Plan next heartbeat action
// ---------------------------------------------------------------------------

export async function planHeartbeat(
	project: WikiProject,
	opts: {
		mode: HeartbeatMode;
		dryRun: boolean;
		budget?: Partial<HeartbeatBudget>;
	},
	ports: HeartbeatPorts,
): Promise<{
	summary: string;
	mode: HeartbeatMode;
	budget: HeartbeatBudget;
	cycles: Array<Record<string, unknown>>;
	stop: Record<string, unknown>;
	policy: Record<string, unknown>;
	bounded_context: Record<string, unknown>;
}> {
	const mode = opts.mode ?? "observe";
	const budget = mergeBudget(mode, opts);
	const dryRun = opts.dryRun ?? true;

	const state = await readCodewikiState(project, {
		include: ["summary", "roadmap", "drift", "session"],
		refresh: mode !== "observe" && budget.maxWrites > 0 && !dryRun,
		taskId: undefined,
	}, ports);

	const nextAction = state.next_action as Record<string, unknown> | undefined;
	const health = state.health as Record<string, unknown> | undefined;
	const summaryState = state.summary as Record<string, unknown> | undefined;
	const needsViewRefresh = Boolean(
		((health?.total_issues as number | undefined) ?? 0) ||
		((summaryState?.unmapped_spec_count as number | undefined) ?? 0),
	);

	const action = mode === "observe"
		? "report"
		: mode === "maintain"
			? (needsViewRefresh ? "refresh_views" : "plan_next")
			: "plan_next";

	const cycles: Array<Record<string, unknown>> = [];
	const stopCondition = "No further cycles planned.";

	if (action === "report") {
		cycles.push({
			cycle: 1,
			action: "report",
			summary: "Reporting current CodeWiki state.",
		});
	} else if (action === "refresh_views") {
		cycles.push({
			cycle: 1,
			action: "refresh_views",
			summary: "Running view refresh.",
		});
	} else {
		cycles.push({
			cycle: 1,
			action: "plan_next",
			summary: "Planning next action from roadmap.",
		});
	}

	return {
		summary: `Heartbeat: ${action}. Next: ${nextAction?.kind ?? "none"}.`,
		mode,
		budget,
		cycles,
		stop: {
			condition: stopCondition,
			reason: "Budget reached.",
			completed: false,
		},
		policy: {
			mode: budget.risk === "low" ? "plan-only" : "plan-with-maintenance",
			allowWrites: budget.maxWrites > 0 && !dryRun,
			maxWrites: budget.maxWrites,
		},
		bounded_context: {
			token_budget: budget.maxCycles ?? 1,
			observed_action: action,
			current_mode: mode,
		},
	};
}