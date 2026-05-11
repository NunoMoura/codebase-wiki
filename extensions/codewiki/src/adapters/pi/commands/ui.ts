import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveCommandProject } from "../../../application/project.ts";
import { startControlRoomServer, type ControlRoomServerHandle } from "../../web/control-room.ts";
import { withUiErrorHandling } from "../ui/manager.ts";

const activeControlRooms = new Map<string, ControlRoomServerHandle>();

export function registerUiCommand(pi: ExtensionAPI): void {
	pi.registerCommand("wiki-ui", {
		description: "Start the standalone local CodeWiki Control Room. Usage: /wiki-ui [repo-path] [port]",
		handler: async (args, ctx) => {
			await withUiErrorHandling(ctx, async () => {
				const parsed = parseUiArgs(args);
				const project = await resolveCommandProject(ctx, parsed.pathArg, "wiki-ui");
				const existing = activeControlRooms.get(project.root);
				if (existing) {
					ctx.ui.notify(`${project.label} Control Room already running: ${existing.url}`, "info");
					return;
				}
				const server = await startControlRoomServer(project, { port: parsed.port });
				activeControlRooms.set(project.root, server);
				ctx.ui.notify(`${project.label} Control Room: ${server.url}`, "info");
			});
		},
	});
}

export function parseUiArgs(args: string): { pathArg: string | null; port?: number } {
	const parts = args.trim().split(/\s+/).filter(Boolean);
	let port: number | undefined;
	const remaining: string[] = [];
	for (const part of parts) {
		if (/^\d+$/.test(part) && port === undefined) {
			const parsed = Number(part);
			if (parsed > 0 && parsed <= 65535) {
				port = parsed;
				continue;
			}
		}
		remaining.push(part);
	}
	return { pathArg: remaining.join(" ") || null, port };
}
