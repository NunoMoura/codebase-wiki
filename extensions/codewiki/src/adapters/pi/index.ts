import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ActiveStatusPanel } from "../../domain/shared/types.ts";
import { registerBootstrapFeatures } from "../../../bootstrap.ts";
import { codewikiBuildToolInputSchema, codewikiAgencyToolInputSchema, codewikiClaimToolInputSchema, codewikiDiffTableToolInputSchema, codewikiSessionToolInputSchema, codewikiTaskToolInputSchema, codewikiValidationReportSchema } from "./schemas.ts";
import { registerConfigCommand } from "./commands/config.ts";
import { registerResumeCommand } from "./commands/resume.ts";
import { registerStatusCommand } from "./commands/status.ts";
import { currentTaskLink } from "./session.ts";
import { readRoadmapTask } from "../../application/roadmap.ts";
import { rememberStatusDockProject, resolveStatusDockProject, resolveToolProject } from "../../application/project.ts";
import { runRebuild } from "../../application/state-artifacts.ts";
import { executeCodewikiAgency } from "./tools/agency.ts";
import { executeCodewikiClaim } from "./tools/claim.ts";
import { executeDiffTableAction } from "../../application/diff-table.ts";
import { executeCodewikiSession } from "./tools/session.ts";
import { registerCodewikiStateTool } from "./tools/state.ts";
import { writeBuild, writeValidationReport } from "../../application/builds.ts";
import { executeCodewikiTask } from "./tools/task.ts";
import {
	activeStatusPanelGlobal,
	clearStatusDock,
	openStatusPanel,
	refreshStatusDock,
	setActiveStatusPanelGlobal,
	setTaskSessionStatus,
	withUiErrorHandling,
} from "./ui/manager.ts";

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
			ctx.ui.setStatus("codewiki-focus", undefined);
			clearStatusDock(ctx);
			return;
		}

		await withUiErrorHandling(ctx, async () => {
			const active = currentTaskLink(ctx);
			if (!active) {
				ctx.ui.setStatus("codewiki-focus", undefined);
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
						`No codewiki project resolved. Use /${COMMAND_PREFIX}-bootstrap first or work inside a repo with .codewiki/config.json.`,
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
		name: "codewiki_build",
		label: "Codewiki Build",
		description:
			"Create transient compiler build artifacts (feedback_build, documentation_build, implementation_build) with lifecycle metadata.",
		promptSnippet:
			"Write accepted compiler handoff builds with lifecycle metadata",
		promptGuidelines: [
			"Use this after the user accepts feedback-loop decisions (kind='feedback') or when knowledge changes must become a documentation build (kind='documentation') or when implementation evidence must be captured (kind='implementation').",
			"Builds are transient payloads, not long-term truth; canonical truth belongs in knowledge, roadmap, tests, and code.",
			"Use kind='feedback' for accepted decisions. Use kind='documentation' when .codewiki/kb/ or roadmap tasks change. Use kind='implementation' to record test/code/check evidence for a task.",
		],
		parameters: codewikiBuildToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_build",
			);
			const result = await writeBuild(project, params as any);
			if ((params as any).refresh ?? true) await runRebuild(project);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: `codewiki build: wrote ${result.path}` }],
				details: result,
			};
		},
	} as any);

	pi.registerTool({
		name: "codewiki_validation",
		label: "Codewiki Validation",
		description:
			"Write a validation report (pass, fail, or block) for a compiler handoff or task close.",
		promptSnippet:
			"Write validation gateway reports with verdict and rationale",
		promptGuidelines: [
			"Use after running a validation gateway. Passing validation can be transient; fail/block/policy-required reports should persist under .codewiki/validation/.",
			"Profile must match a known validation gateway profile: feedback, documentation, implementation, task-close, drift-audit, or graph-audit.",
		],
		parameters: codewikiValidationReportSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_validation",
			);
			const result = await writeValidationReport(project, params as any);
			if ((params as any).refresh ?? true) await runRebuild(project);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: `codewiki validation: wrote ${result.path}` }],
				details: result,
			};
		},
	} as any);

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
		name: "codewiki_claim",
		label: "Codewiki Claim",
		description:
			"Create, release, heartbeat, or list scoped change claims for parallel CodeWiki work",
		promptSnippet:
			"Use scoped change claims to coordinate parallel sessions across docs, roadmap, builds, validation, and code.",
		promptGuidelines: [
			"Use this before non-trivial semantic changes when another session may touch overlapping docs, roadmap items, builds, validation reports, or code paths.",
			"Claims are temporary leases, not requirements or source of truth; roadmap tasks, builds, validation, and code remain canonical truth.",
			"Read/read overlap is safe, read/write overlap warns, and write/write overlap blocks unless explicitly forced.",
		],
		parameters: codewikiClaimToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_claim",
			);
			const result = await executeCodewikiClaim(pi, project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	} as any);

	pi.registerTool({
		name: "codewiki_diff_table",
		label: "Codewiki Diff Table",
		description: "Create or update pending feedback diff tables before accepted feedback builds are compiled.",
		promptSnippet: "Use pending diff tables for interactive feedback approval before writing accepted feedback builds.",
		parameters: codewikiDiffTableToolInputSchema,
		execute: async (_id: string, params: any, _notify: any, _progress: any, ctx: any) => {
			const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_diff_table");
			const result = await executeDiffTableAction(project, params);
			return {
				content: [{ type: "text", text: `codewiki diff_table: ${params.action}` }],
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
		name: "codewiki_agency",
		label: "Codewiki Agency",
		description:
			"Plan one bounded CodeWiki agency run in observe, maintain, or work mode",
		promptSnippet:
			"Run bounded CodeWiki agency planning without unbounded autonomous edits",
		promptGuidelines: [
			"Use observe for read-only status and next-action selection.",
			"Use maintain for safe generated-view refresh and audit planning under write budget.",
			"Use work only when user intent allows bounded implementation; stop on risk, ambiguity, or budget.",
			"Parent agent remains responsible for any canonical writes, commits, pushes, or version bumps.",
		],
		parameters: codewikiAgencyToolInputSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const project = await resolveToolProject(
				ctx.cwd,
				params.repoPath,
				"codewiki_agency",
			);
			const result = await executeCodewikiAgency(project, ctx, params);
			await refreshStatusDock(project, ctx, currentTaskLink(ctx));
			return {
				content: [{ type: "text", text: result.summary }],
				details: result,
			};
		},
	} as any);
}
