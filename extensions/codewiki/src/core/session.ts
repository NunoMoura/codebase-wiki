import type {
	CodewikiContextPort,
	CodewikiRuntimePort,
} from "./ports";
import type {
	TaskSessionLinkRecord,
	TaskSessionLinkInput,
	TaskSessionAction,
	WikiProject,
	RoadmapTaskRecord,
} from "./types";
import { resolve } from "node:path";
import { withLockedPaths } from "../../mutation-queue";
import {
	rebuildTargetPaths,
	runRebuildUnlocked,
} from "./state";
import {
	appendTaskSessionEvent,
} from "./project";
import {
	nowIso,
	unique,
} from "./utils";
import {
	readRoadmapTask,
} from "./roadmap";

// Constants from index.ts
const TASK_SESSION_LINK_CUSTOM_TYPE = "codewiki.task-link";

/**
 * Get the current focused task link from context.
 */
export function currentTaskLink(
	ctx: CodewikiContextPort,
): TaskSessionLinkRecord | null {
	const entries = (
		ctx as {
			sessionManager?: {
				getBranch?: () => unknown[];
			};
		}
	).sessionManager?.getBranch?.();
	return findLatestTaskSessionLink(entries);
}

/**
 * Get the current session ID.
 */
export function currentSessionId(
	ctx: CodewikiContextPort,
): string {
	const manager = (
		ctx as {
			sessionManager?: {
				getSessionId?: () => string;
			};
		}
	).sessionManager;
	return typeof manager?.getSessionId === "function"
		? manager.getSessionId()
		: "unknown";
}

/**
 * Link a task to the current Pi session.
 */
export async function linkTaskSession(
	pi: CodewikiRuntimePort,
	project: WikiProject,
	ctx: CodewikiContextPort,
	input: TaskSessionLinkInput,
	options: { refresh?: boolean } = {},
): Promise<TaskSessionLinkRecord & { title: string; renamed: boolean }> {
	const task = await readRoadmapTask(project, input.taskId);
	if (!task) throw new Error(`Roadmap task not found: ${input.taskId}`);
	const link = normalizeTaskSessionLinkInput(input);
	let renamed = false;
	await withLockedPaths(
		[
			resolve(project.root, project.eventsPath),
			...((options.refresh ?? true) ? rebuildTargetPaths(project) : []),
		],
		async () => {
			await recordTaskSessionLinkUnlocked(pi, ctx, task, link);
			await appendTaskSessionEvent(project, task, link, currentSessionId(ctx));
			if (options.refresh ?? true) await runRebuildUnlocked(project);
		},
	);
	return {
		...link,
		title: task.title,
		renamed,
	};
}

/**
 * Normalize task session link input.
 */
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

/**
 * Normalize task session action.
 */
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

/**
 * Record a task session link in the Pi session history.
 */
export async function recordTaskSessionLinkUnlocked(
	pi: CodewikiRuntimePort,
	ctx: CodewikiContextPort,
	task: RoadmapTaskRecord,
	input: TaskSessionLinkInput | TaskSessionLinkRecord,
): Promise<void> {
	const link =
		"timestamp" in input ? input : normalizeTaskSessionLinkInput(input);
	if (!hasSessionManager(ctx)) {
		if (link.action === "clear") {
			ctx.ui.setStatus("codewiki-task", undefined);
			return;
		}
		setTaskSessionStatusText(ctx, task.id, task.title, link.action);
		return;
	}
	const shouldSetSessionName =
		("setSessionName" in input ? input.setSessionName : undefined) ??
		link.action === "focus";
	if (shouldSetSessionName) {
		try {
			pi.setSessionName(`${task.id} ${task.title}`);
		} catch {
			// Ignore
		}
	}
	try {
		pi.appendEntry(TASK_SESSION_LINK_CUSTOM_TYPE, {
			taskId: task.id,
			action: link.action,
			summary: link.summary,
			filesTouched: link.filesTouched,
			spawnedTaskIds: link.spawnedTaskIds,
		});
	} catch {
		// Ignore
	}

	if (link.action === "clear") {
		ctx.ui.setStatus("codewiki-task", undefined);
		return;
	}
	setTaskSessionStatusText(ctx, task.id, task.title, link.action);
}

export function setTaskSessionStatusText(
	ctx: CodewikiContextPort,
	_taskId: string,
	_title: string,
	_action: TaskSessionAction,
): void {
	ctx.ui.setStatus("codewiki-task", undefined);
}

/**
 * Find the latest task session link in a list of entries.
 */
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

/**
 * Parse a task session link entry.
 */
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
	)
		return null;
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

/**
 * Check if the context has a session manager.
 */
export function hasSessionManager(
	ctx: CodewikiContextPort,
): boolean {
	const manager = (
		ctx as {
			sessionManager?: {
				getSessionId?: () => string;
				getBranch?: () => unknown[];
			};
		}
	).sessionManager;
	return (
		typeof manager?.getSessionId === "function" ||
		typeof manager?.getBranch === "function"
	);
}
