import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
	WikiProject,
	CodewikiSessionToolInput,
} from "../../../core/types";
import { nowIso } from "../../../core/utils";
import {
	getFocusedTaskLink,
	clearSessionFocus,
	recordSessionTaskAction,
} from "../../../application/session";
import { readFile, writeFile, appendFile } from "node:fs/promises";

function piSessionPorts(pi: ExtensionAPI, ctx: ExtensionContext) {
	return {
		fileStore: {
			readJson: async (path: string) => JSON.parse(await readFile(path, "utf8")),
			maybeReadJson: async (path: string) => {
				try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
			},
			writeJson: async (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2), "utf8"),
			appendJsonl: async (path: string, record: unknown) => appendFile(path, JSON.stringify(record) + "\n", "utf8"),
		},
		runtime: {
			setSessionName: (name: string) => pi.setSessionName(name),
			appendEntry: (type: string, data: unknown) => pi.appendEntry(type, data),
		},
		sessionStore: {
			getCurrentSessionId: () => ctx.sessionManager.getSessionId(),
			getSessionBranch: () => ctx.sessionManager.getBranch(),
		},
		notifier: {
			notify: (message: string, level: "info" | "warning" | "error") => ctx.ui.setStatus("codewiki-session", `${level}: ${message}`),
			setStatus: (key: string, value: string | undefined) => ctx.ui.setStatus(key, value),
		},
	};
}

/**
 * Implementation of the codewiki_session tool.
 */
export async function executeCodewikiSession(
	pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiSessionToolInput,
) {
	const ports = piSessionPorts(pi, ctx);
	if (input.action === "clear") {
		const active = getFocusedTaskLink(ports);
		if (!active) {
			return {
				action: "clear" as const,
				session: {
					focused_task_id: null,
					updated_at: nowIso(),
					summary: input.summary?.trim() || null,
				},
				renamed: false,
				summary: buildCodewikiSessionSummary({
					action: "clear",
					session: { focused_task_id: null },
				}),
			};
		}
		await clearSessionFocus(project, ports, input.summary?.trim());
		const result = {
			action: "clear" as const,
			session: {
				focused_task_id: null,
				updated_at: nowIso(),
				summary: input.summary?.trim() || null,
			},
			renamed: false,
			summary: "",
		};
		result.summary = buildCodewikiSessionSummary(result);
		return result;
	}

	const result = await recordSessionTaskAction(project, {
		taskId: input.taskId,
		action: input.action,
		summary: input.summary,
		filesTouched: input.files_touched,
		setSessionName: input.action === "focus" ? (input.setSessionName ?? false) : false,
	}, ports);
	return {
		action: input.action,
		session: {
			focused_task_id: result.taskId,
			updated_at: result.timestamp,
			summary: result.summary,
		},
		renamed: result.renamed,
		summary: buildCodewikiSessionSummary({
			action: input.action,
			session: { focused_task_id: result.taskId },
		}),
	};
}

function buildCodewikiSessionSummary(result: {
	action: "focus" | "note" | "clear";
	session: { focused_task_id: string | null };
}): string {
	if (result.action === "clear") return "codewiki session: focus cleared";
	if (!result.session.focused_task_id)
		return `codewiki session: ${result.action} recorded`;
	return `codewiki session: ${result.action} ${result.session.focused_task_id}`;
}
