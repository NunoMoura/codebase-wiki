import type {
	ExtensionAPI,
	ExtensionCommandContext,
    ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
	resolveCommandProject,
	resolveStatusDockProject,
	rememberStatusDockProject,
} from "../../../core/project";
import {
	withUiErrorHandling,
	openStatusPanel,
	refreshStatusDock,
    activeStatusPanelGlobal,
} from "../ui/manager";
import { currentTaskLink } from "../../../core/session";
import { maybeReadStatusState, maybeReadRoadmapState } from "../../../core/state";
import { maybeReadJson } from "../../../core/utils";
import type { LintReport } from "../../../core/types";

/**
 * Register the wiki-status command.
 */
export function registerStatusCommand(pi: ExtensionAPI): void {
	pi.registerCommand(`wiki-status`, {
		description:
			"Open Codewiki project status panel. Usage: /wiki-status [repo-path]",
		handler: async (args, ctx) => {
			await withUiErrorHandling(ctx, async () => {
				const pathArg = args.trim() || null;
				const project = pathArg
					? await resolveCommandProject(
							ctx,
							pathArg,
							`wiki-status`,
						)
					: (await resolveStatusDockProject(ctx, { allowWhenOff: true }))
							?.project;
				const source: string = pathArg
					? "cwd"
					: ((await resolveStatusDockProject(ctx, { allowWhenOff: true }))
							?.source ?? "cwd");
				if (!project) {
					ctx.ui.notify(
						`No codewiki project resolved. Use /wiki-bootstrap first or work inside a repo with .wiki/config.json.`,
						"warning",
					);
					return;
				}
				await rememberStatusDockProject(project);
				await refreshStatusDock(project, ctx, currentTaskLink(ctx));
				const opened = await openStatusPanel(
					pi,
					project,
					ctx,
					"both",
					currentTaskLink(ctx),
					source,
					(activeStatusPanelRef) => {
                        // Global state update should be handled in manager.ts via openStatusPanel
					},
					"product",
				);
				if (!opened) {
					const state = await maybeReadStatusState(project.statusStatePath);
					const report = await maybeReadJson<LintReport>(project.lintPath);
					const roadmapState = await maybeReadRoadmapState(
						project.roadmapStatePath,
					);
					if (state && report) {
                        // buildStatusText was removed, but we should probably use a simpler notification if custom UI is unavailable
						ctx.ui.notify(
							"Custom UI unavailable. Use codewiki_state output or configure Pi UI mode.",
							"warning",
						);
                    } else {
						ctx.ui.notify(
							"Custom UI unavailable. Use codewiki_state output or configure Pi UI mode.",
							"warning",
						);
                    }
				}
			});
		},
	});
}
