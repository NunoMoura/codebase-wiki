import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type {
	WikiProject,
	CodewikiSessionToolInput,
} from "../../../domain/shared/types.ts";
import { nowIso } from "../../../domain/shared/utils.ts";
import {
	getFocusedTaskLink,
	clearSessionFocus,
	recordSessionTaskAction,
} from "../../../application/session.ts";
import { piSessionPorts } from "../session.ts";

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
		cursor: input.cursor,
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
