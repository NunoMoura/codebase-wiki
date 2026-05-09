import type {
	WikiProject,
	CodewikiStateToolInput,
} from "../../../domain/shared/types";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { codewikiStateToolInputSchema } from "../../../core/schemas";
import { readCodewikiState } from "../../../application/state";
import { resolveToolProject } from "../../../core/project";
import { currentTaskLink, piSessionStore } from "../session";
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
			const result = await readCodewikiState(project, {
				include: params.include,
				taskId: params.taskId,
				refresh: params.refresh ?? false,
			}, {
				fileStore: piFileStore(),
				rebuildRunner: piRebuildRunner(),
				sessionStore: piSessionStore(ctx),
			});
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

// ---------------------------------------------------------------------------
// Pi port adapters — build port implementations
// ---------------------------------------------------------------------------

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
