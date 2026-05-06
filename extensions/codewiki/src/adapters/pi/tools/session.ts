import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
	WikiProject,
	CodewikiSessionToolInput,
	TaskSessionLinkRecord,
} from "../../../core/types";
import {
	nowIso,
	unique,
} from "../../../core/utils";
import {
	currentTaskLink,
	linkTaskSession,
} from "../../../core/session";

/**
 * Implementation of the codewiki_session tool.
 */
export async function executeCodewikiSession(
	pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiSessionToolInput,
) {
	if (input.action === "clear") {
		const active = currentTaskLink(ctx);
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
		await linkTaskSession(
			pi,
			project,
			ctx,
			{
				taskId: active.taskId,
				action: "clear",
				summary:
					input.summary?.trim() ||
					`Cleared current Pi session focus from ${active.taskId}.`,
				setSessionName: false,
			},
			{ refresh: false },
		);
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
	const taskId = input.taskId?.trim() || currentTaskLink(ctx)?.taskId;
	if (!taskId) {
		throw new Error(
			`codewiki_session ${input.action} requires taskId or an active focused task.`,
		);
	}
	const summary =
		input.summary?.trim() ||
		(input.action === "focus"
			? `Focused current Pi session on ${taskId}.`
			: `Recorded runtime session note for ${taskId}.`);
	const result = await linkTaskSession(
		pi,
		project,
		ctx,
		{
			taskId,
			action: input.action,
			summary,
			filesTouched: unique(input.files_touched ?? []),
			spawnedTaskIds: [],
			setSessionName:
				input.action === "focus" ? (input.setSessionName ?? false) : false,
		},
		{ refresh: false },
	);
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
