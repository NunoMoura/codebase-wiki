import type {
	TaskSessionAction,
	TaskSessionLinkInput,
	TaskSessionLinkRecord,
} from "./types";
import { nowIso, unique } from "./utils";

const TASK_SESSION_LINK_CUSTOM_TYPE = "codewiki.task-link";

export function normalizeTaskSessionLinkInput(
	input: TaskSessionLinkInput,
): TaskSessionLinkRecord {
	return {
		taskId: input.taskId,
		action: normalizeTaskSessionAction(input.action),
		summary: typeof input.summary === "string" ? input.summary : "",
		filesTouched: unique(input.filesTouched ?? []),
		spawnedTaskIds: unique(input.spawnedTaskIds ?? []),
		timestamp: nowIso(),
	};
}

export function normalizeTaskSessionAction(
	action: string | undefined,
): TaskSessionAction {
	const a = (action || "focus").trim();
	return a === "focus" ||
		a === "progress" ||
		a === "blocked" ||
		a === "done" ||
		a === "spawn" ||
		a === "note" ||
		a === "clear"
		? a
		: "focus";
}

export function findLatestTaskSessionLink(
	entries: unknown[] | null | undefined,
): TaskSessionLinkRecord | null {
	if (!Array.isArray(entries) || entries.length === 0) return null;
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const parsed = parseTaskSessionLinkEntry(entries[index]);
		if (parsed) return parsed;
	}
	return null;
}

export function parseTaskSessionLinkEntry(
	entry: unknown,
): TaskSessionLinkRecord | null {
	const value = entry as {
		type?: string;
		customType?: string;
		timestamp?: string;
		data?: {
			taskId?: string;
			action?: string;
			summary?: string;
			filesTouched?: string[];
			spawnedTaskIds?: string[];
		};
	};
	if (
		value?.type !== "custom" ||
		value.customType !== TASK_SESSION_LINK_CUSTOM_TYPE ||
		!value.data?.taskId
	) {
		return null;
	}
	try {
		return {
			taskId: String(value.data.taskId),
			action: normalizeTaskSessionAction(value.data.action),
			summary: typeof value.data.summary === "string" ? value.data.summary : "",
			filesTouched: Array.isArray(value.data.filesTouched)
				? unique(value.data.filesTouched)
				: [],
			spawnedTaskIds: Array.isArray(value.data.spawnedTaskIds)
				? unique(value.data.spawnedTaskIds)
				: [],
			timestamp:
				typeof value.timestamp === "string" ? value.timestamp : nowIso(),
		};
	} catch {
		return null;
	}
}
