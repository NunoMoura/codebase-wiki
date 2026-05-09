import type {
    WikiProject,
    HeartbeatToolInput,
} from "../../../core/types";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { planHeartbeat } from "../../../application/heartbeat";
import { piSessionStore } from "../session";
import { readFile, writeFile, appendFile } from "node:fs/promises";

/**
 * Execute the codewiki_heartbeat tool.
 */
export async function executeCodewikiHeartbeat(
	project: WikiProject,
	ctx: ExtensionContext,
	input: HeartbeatToolInput,
): Promise<{
    summary: string;
    mode: string;
    budget: Record<string, unknown>;
    cycles: Array<Record<string, unknown>>;
    stop: Record<string, unknown>;
    policy: Record<string, unknown>;
    bounded_context: Record<string, unknown>;
}> {
	const result = await planHeartbeat(project, {
		mode: (input.mode as any) ?? "observe",
		dryRun: input.dryRun ?? true,
		budget: input.budget,
	}, {
		fileStore: piFileStore(),
		rebuildRunner: piRebuildRunner(),
		sessionStore: piSessionStore(ctx),
	});

	return {
		...result,
		budget: result.budget as unknown as Record<string, unknown>,
		bounded_context: buildThinkCodeContextPlan(result.mode as any, String(result.cycles[0]?.action ?? "report"), project),
	};
}

function piFileStore() {
	return {
		readJson: async (path: string) => JSON.parse(await readFile(path, "utf8")),
		maybeReadJson: async (path: string) => {
			try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
		},
		writeJson: async (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2), "utf8"),
		appendJsonl: async (path: string, record: unknown) => appendFile(path, JSON.stringify(record) + "\n", "utf8"),
	};
}

function piRebuildRunner() {
	return {
		run: async (project: WikiProject) => {
			const { runConfiguredOrDefaultRebuild } = await import("../../../infrastructure/rebuild-runner");
			await runConfiguredOrDefaultRebuild(project);
		},
	};
}


function buildThinkCodeContextPlan(
	mode: string,
	action: string,
	project: WikiProject,
): Record<string, unknown> {
	const script = [
		'tc_emit "{\\\"kind\\\":\\\"codewiki-context\\\",\\\"source\\\":\\\"think-code\\\"}"',
		'tc_context .codewiki/status.json .codewiki/roadmap/queue.json .codewiki/drift.json 2>/dev/null || true',
		'tc_grep --json "stale|unmapped|blocked|TASK-" .codewiki/views .codewiki/roadmap 2>/dev/null || true',
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
				"read .codewiki/views/status.json or task context shard only when exact source is required",
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
