import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ActiveStatusPanel } from "../../core/types";
import { registerBootstrapFeatures } from "../../../bootstrap";
import { codewikiHeartbeatToolInputSchema, codewikiSessionToolInputSchema, codewikiTaskToolInputSchema } from "../../core/schemas";
import { registerConfigCommand } from "./commands/config";
import { registerResumeCommand } from "./commands/resume";
import { registerStatusCommand } from "./commands/status";
import { currentTaskLink } from "../../core/session";
import { readRoadmapTask } from "../../core/roadmap";
import { rememberStatusDockProject, resolveStatusDockProject, resolveToolProject } from "../../core/project";
import { executeCodewikiHeartbeat } from "./tools/heartbeat";
import { executeCodewikiSession } from "./tools/session";
import { registerCodewikiStateTool } from "./tools/state";
import { executeCodewikiTask } from "./tools/task";
import {
	activeStatusPanelGlobal,
	clearStatusDock,
	openStatusPanel,
	refreshStatusDock,
	setActiveStatusPanelGlobal,
	setTaskSessionStatus,
	withUiErrorHandling,
} from "./ui/manager";

const COMMAND_PREFIX = "wiki";

export function registerPiAdapter(pi: ExtensionAPI): void {
	registerBootstrapFeatures(pi);
	let activeStatusPanel: ActiveStatusPanel | null = activeStatusPanelGlobal;

	pi.on("turn_start", async (_event, ctx) => {
		const resolved = await resolveStatusDockProject(ctx);
		if (!resolved) {
			clearStatusDock(ctx);
			return;
		}
		await withUiErrorHandling(ctx, async () => {
			await refreshStatusDock(
				resolved.project,
				ctx,
				currentTaskLink(ctx),
				resolved,
			);
		});
	});

	pi.on("session_start", async (_event, ctx) => {
		const resolved = await resolveStatusDockProject(ctx);
		if (!resolved) {
			ctx.ui.setStatus("codewiki-task", undefined);
			clearStatusDock(ctx);
			return;
		}

		await withUiErrorHandling(ctx, async () => {
			const active = currentTaskLink(ctx);
			if (!active) {
				ctx.ui.setStatus("codewiki-task", undefined);
				await refreshStatusDock(resolved.project, ctx, active, resolved);
				return;
			}
			const task = await readRoadmapTask(resolved.project, active.taskId);
			if (task) setTaskSessionStatus(ctx, task.id, task.title, active.action);
			await refreshStatusDock(resolved.project, ctx, active, resolved);
		});
	});

	registerConfigCommand(pi);
	registerStatusCommand(pi);
	registerResumeCommand(pi);

	pi.registerShortcut("alt+w", {
		description: "Toggle Codewiki status panel",
		handler: async (ctx) => {
			await withUiErrorHandling(ctx, async () => {
				if (activeStatusPanel?.close) {
					activeStatusPanel.close();
					activeStatusPanel = activeStatusPanelGlobal;
					return;
				}
				const resolved = await resolveStatusDockProject(ctx, {
					allowWhenOff: true,
				});
				if (!resolved) {
					ctx.ui.notify(
						`No codewiki project resolved. Use /${COMMAND_PREFIX}-bootstrap first or work inside a repo with .wiki/config.json.`,
						"warning",
					);
					return;
				}
				await rememberStatusDockProject(resolved.project);
				await refreshStatusDock(
					resolved.project,
					ctx,
					currentTaskLink(ctx),
					resolved,
				);
				const opened = await openStatusPanel(
					pi,
					resolved.project,
					ctx,
					"both",
					currentTaskLink(ctx),
					resolved.source,
					(activeStatusPanelRef) => {
						activeStatusPanel = activeStatusPanelRef;
						setActiveStatusPanelGlobal(activeStatusPanelRef);
					},
				);
				if (!opened) {
					ctx.ui.notify(
						"Custom UI unavailable. Use codewiki_state output or configure Pi UI mode.",
						"warning",
					);
				}
			});
		},
	});

	registerCodewikiStateTool(pi);

	pi.registerTool({
		name: "codewiki_task",
		label: "Codewiki Task",
		description:
			"Create, update, close, or cancel roadmap tasks through one canonical task mutation tool",
		promptSnippet:
			"Mutate canonical roadmap task truth through one create/update/close/cancel entrypoint",
		promptGuidelines: [
			"Use this for all canonical roadmap task mutation: create tasks, update metadata, append evidence, close work, or cancel work.",
			"Prefer evidence.result='pass'|'fail'|'block' when advancing lifecycle with structured execution evidence.",
			"Use action='close' or action='cancel' instead of patching status directly when intent is final closure.",
			"Set refresh=false when you need a minimal canonical write and can defer generated graph/status/roadmap view rebuilds.",
		],
		parameters: codewikiTaskToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_task",
			);
			const result = await executeCodewikiTask(pi, project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	} as any);

	pi.registerTool({
		name: "codewiki_session",
		label: "Codewiki Session",
		description:
			"Manage runtime session focus and notes for codewiki without mutating canonical roadmap truth",
		promptSnippet:
			"Manage runtime codewiki session focus and notes separately from canonical roadmap task state",
		promptGuidelines: [
			"Use this when current Pi session focus changes or when you need runtime notes linked to current work.",
			"This tool should not be used to close, cancel, or otherwise mutate canonical roadmap truth.",
		],
		parameters: codewikiSessionToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_session",
			);
			const result = await executeCodewikiSession(pi, project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	} as any);

	pi.registerTool({
		name: "codewiki_heartbeat",
		label: "Codewiki Heartbeat",
		description:
			"Plan one bounded CodeWiki heartbeat run in observe, maintain, or work mode",
		promptSnippet:
			"Run bounded CodeWiki heartbeat planning without unbounded autonomous edits",
		promptGuidelines: [
			"Use observe for read-only status and next-action selection.",
			"Use maintain for safe generated-view refresh and audit planning under write budget.",
			"Use work only when user intent allows bounded implementation; stop on risk, ambiguity, or budget.",
			"Parent agent remains responsible for any canonical writes, commits, pushes, or version bumps.",
		],
		parameters: codewikiHeartbeatToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_heartbeat",
			);
			const result = await executeCodewikiHeartbeat(project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	} as any);
}
