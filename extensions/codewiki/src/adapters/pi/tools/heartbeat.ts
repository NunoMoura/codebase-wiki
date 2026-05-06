import type {
    WikiProject,
    HeartbeatBudget,
    HeartbeatMode,
    HeartbeatToolInput,
} from "../../../core/types";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { readCodewikiState } from "./state";

/**
 * Execute the codewiki_heartbeat tool.
 */
export async function executeCodewikiHeartbeat(
	project: WikiProject,
	ctx: ExtensionContext,
	input: HeartbeatToolInput,
): Promise<{ 
    summary: string; 
    mode: HeartbeatMode; 
    budget: HeartbeatBudget; 
    cycles: Array<Record<string, unknown>>; 
    stop: Record<string, unknown>; 
    policy: Record<string, unknown>; 
    bounded_context: Record<string, unknown> 
}> {
	const mode: HeartbeatMode = input.mode ?? "observe";
	const budget = mergeHeartbeatBudget(mode, input);
	const dryRun = input.dryRun ?? true;
	const state = await readCodewikiState(project, ctx, {
		repoPath: input.repoPath,
		refresh: mode !== "observe" && budget.maxWrites > 0 && !dryRun,
		include: ["summary", "roadmap", "drift", "session"],
	});
	const nextAction = state.next_action as Record<string, unknown> | undefined;
	const health = state.health as Record<string, unknown> | undefined;
	const summaryState = state.summary as Record<string, unknown> | undefined;
	const needsViewRefresh = Boolean((health?.total_issues as number | undefined) ?? 0) || Boolean((summaryState?.unmapped_spec_count as number | undefined) ?? 0);
	const action = mode === "observe"
		? "report"
		: mode === "maintain"
			? (needsViewRefresh ? "refresh-views-and-audit" : "audit-views")
			: (nextAction?.taskId ? "resume-task" : needsViewRefresh ? "plan-maintenance" : "stop-clean");
	const cycles = [
		{
			cycle: 1,
			reads: ["codewiki_state"],
			action,
			next_action: nextAction ?? null,
			writes_planned: mode === "observe" || dryRun ? 0 : Math.min(1, budget.maxWrites),
			subagents_planned: mode === "observe" ? 0 : Math.min(1, budget.maxSubagents),
		},
	];
	const stop = {
		reason: dryRun ? "dry_run" : "first_cycle_planned",
		conditions: [
			"max_cycles",
			"max_wall_seconds",
			"max_writes",
			"max_subagents",
			"risk_exceeds_budget",
			"ambiguous_or_destructive_action",
			"checks_fail",
		],
	};
	const policy = {
		canonical_writes_by_parent_only: true,
		push_version_archive_require_policy_and_green_checks: true,
		no_unbounded_autonomy: true,
	};
	return {
		summary: `codewiki heartbeat ${mode}: ${action}; stop=${stop.reason}; budget cycles=${budget.maxCycles} writes=${budget.maxWrites} subagents=${budget.maxSubagents} risk=${budget.risk}`,
		mode,
		budget,
		cycles,
		stop,
		policy,
		bounded_context: buildThinkCodeContextPlan(mode, action, project),
	};
}

function defaultHeartbeatBudget(mode: HeartbeatMode): HeartbeatBudget {
	if (mode === "observe") {
		return {
			maxCycles: 1,
			maxWallSeconds: 30,
			maxWrites: 0,
			maxSubagents: 0,
			risk: "low",
		};
	}
	if (mode === "maintain") {
		return {
			maxCycles: 2,
			maxWallSeconds: 120,
			maxWrites: 1,
			maxSubagents: 1,
			risk: "low",
		};
	}
	return {
		maxCycles: 3,
		maxWallSeconds: 300,
		maxWrites: 3,
		maxSubagents: 2,
		risk: "medium",
	};
}

function mergeHeartbeatBudget(
	mode: HeartbeatMode,
	input: HeartbeatToolInput,
): HeartbeatBudget {
	const defaults = defaultHeartbeatBudget(mode);
	return {
		maxCycles: Math.max(1, Math.floor(input.budget?.maxCycles ?? defaults.maxCycles)),
		maxWallSeconds: Math.max(1, Math.floor(input.budget?.maxWallSeconds ?? defaults.maxWallSeconds)),
		maxWrites: Math.max(0, Math.floor(input.budget?.maxWrites ?? defaults.maxWrites)),
		maxSubagents: Math.max(0, Math.floor(input.budget?.maxSubagents ?? defaults.maxSubagents)),
		risk: input.budget?.risk ?? defaults.risk,
	};
}

function buildThinkCodeContextPlan(
	mode: HeartbeatMode,
	action: string,
	project: WikiProject,
): Record<string, unknown> {
	const script = [
		'tc_emit "{\\\"kind\\\":\\\"codewiki-context\\\",\\\"source\\\":\\\"think-code\\\"}"',
		'tc_context .wiki/views/status.json .wiki/views/roadmap/queue.json .wiki/views/drift.json 2>/dev/null || true',
		'tc_grep --json "stale|unmapped|blocked|TASK-" .wiki/views .wiki/roadmap 2>/dev/null || true',
	].join("\n");
	return {
		preferred_executor: "think_code_run",
		availability: "optional",
		mode,
		action,
		goal: "Create compact CodeWiki context or validate graph/view cues without loading raw wiki trees into parent context.",
		think_code: {
			policyPath: "think-code.policy.json",
			script,
			writes: "staged-only; apply requires separate think_code_apply and CodeWiki policy approval",
		},
		fallback: {
			executor: "native-codewiki",
			steps: [
				"codewiki_state refresh=true include=summary,roadmap,drift,session",
				"read .wiki/views/status.json or task context shard only when exact source is required",
				"use scripts/codewiki-gateway.mjs pack/tree/manifest for compact reads",
			],
		},
		non_goals: [
			"Do not require ThinkCode for CodeWiki operation.",
			"Do not let ThinkCode mutate generated views directly.",
		],
		root: project.root,
	};
}
