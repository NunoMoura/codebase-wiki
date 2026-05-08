/**
 * application/session.ts
 *
 * Session focus management use cases.
 * Links runtime agent session state to the CodeWiki roadmap without importing Pi types.
 */
import type { WikiProject, TaskSessionLinkRecord, TaskSessionAction } from "../domain/shared/types";
import type { CodewikiContextPort, CodewikiRuntimePort } from "../core/ports";
import { linkTaskSession, currentTaskLink as coreCurrentTaskLink } from "../core/session";
import { unique } from "../core/utils";
import type { FileStore } from "./ports";

export interface SessionPorts {
	fileStore: FileStore;
	runtime: CodewikiRuntimePort;
	context: CodewikiContextPort;
	getSessionId: () => string | null;
	getSessionFile: () => string;
	getSessionName: () => string;
	getSessionBranch: () => unknown[];
}

export function getFocusedTaskLink(
	ports: SessionPorts,
): TaskSessionLinkRecord | null {
	return coreCurrentTaskLink(ports.context);
}

export async function recordSessionTaskAction(
	project: WikiProject,
	opts: {
		taskId?: string;
		action: TaskSessionAction;
		summary?: string;
		filesTouched?: string[];
		setSessionName?: boolean;
	},
	ports: SessionPorts,
): Promise<TaskSessionLinkRecord & { title: string; renamed: boolean }> {
	const active = getFocusedTaskLink(ports);
	const taskId = opts.taskId?.trim() || active?.taskId;
	if (!taskId) {
		throw new Error(
			`codewiki_session ${opts.action} requires taskId or an active focused task.`,
		);
	}
	const summary = opts.summary?.trim() ||
		(opts.action === "focus"
			? `Focused current session on ${taskId}.`
			: `Recorded runtime session note for ${taskId}.`);
	return linkTaskSession(
		ports.runtime,
		project,
		ports.context,
		{
			taskId,
			action: opts.action,
			summary,
			filesTouched: unique(opts.filesTouched ?? []),
			spawnedTaskIds: [],
			setSessionName: opts.action === "focus" ? (opts.setSessionName ?? false) : false,
		},
		{ refresh: false },
	);
}

export async function focusOnTask(
	project: WikiProject,
	taskId: string,
	opts: { summary?: string; setSessionName?: boolean },
	ports: SessionPorts,
): Promise<TaskSessionLinkRecord & { title: string; renamed: boolean }> {
	return recordSessionTaskAction(project, {
		taskId,
		action: "focus",
		summary: opts.summary,
		setSessionName: opts.setSessionName,
	}, ports);
}

export async function clearSessionFocus(
	project: WikiProject,
	ports: SessionPorts,
	summary?: string,
): Promise<(TaskSessionLinkRecord & { title: string; renamed: boolean }) | null> {
	const active = getFocusedTaskLink(ports);
	if (!active) return null;
	return linkTaskSession(
		ports.runtime,
		project,
		ports.context,
		{
			taskId: active.taskId,
			action: "clear",
			summary: summary?.trim() || `Cleared current session focus from ${active.taskId}.`,
			setSessionName: false,
		},
		{ refresh: false },
	);
}
