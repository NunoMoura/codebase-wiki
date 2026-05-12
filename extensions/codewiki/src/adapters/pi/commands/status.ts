import type {
	ExtensionAPI,
	ExtensionCommandContext,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	resolveCommandProject,
	resolveStatusDockProject,
	rememberStatusDockProject,
} from "../../../application/project.ts";
import {
	withUiErrorHandling,
	openStatusPanel,
	refreshStatusDock,
    activeStatusPanelGlobal,
} from "../ui/manager.ts";
import { currentTaskLink } from "../session.ts";
import { maybeReadStatusState, maybeReadRoadmapState } from "../../../application/state-artifacts.ts";
import { maybeReadJson } from "../../../infrastructure/filesystem.ts";
import type { LintReport, StatusPanelSection } from "../../../domain/shared/types.ts";

/**
 * Register the wiki-status command.
 */
export function registerStatusCommand(pi: ExtensionAPI): void {
	pi.registerCommand(`wiki-status`, {
		description:
			"Open Codewiki project status panel. Usage: /wiki-status [repo-path] [status|product|system|board|graph]",
		handler: async (args, ctx) => {
			await withUiErrorHandling(ctx, async () => {
				const parts = args.trim().split(/\s+/).filter(Boolean);
				const sectionCandidate = parts[parts.length - 1];
				const sectionAlias: Record<string, StatusPanelSection> = { status: "home", home: "home", product: "product", system: "system", board: "roadmap", roadmap: "roadmap", graph: "graph" };
				const section = sectionAlias[sectionCandidate || ""] ?? "home";
				if (sectionCandidate && sectionCandidate in sectionAlias) parts.pop();
				const pathArg = parts.join(" ") || null;
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
						`No codewiki project resolved. Use /wiki-bootstrap first or work inside a repo with .codewiki/config.json.`,
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
					section,
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
