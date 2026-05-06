import { unique } from "./utils";

/**
 * Parse a task ID sequence number.
 */
export function parseTaskIdSequence(taskId: string): number | null {
	const match = taskId.match(/^(?:T|TASK-)(\d+)$/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Format a task ID from a sequence number.
 */
export function formatTaskId(sequence: number): string {
	return `T${sequence}`;
}

/**
 * Format a legacy task ID from a sequence number.
 */
export function formatLegacyTaskId(sequence: number): string {
	return `TASK-${sequence}`;
}

/**
 * Generate candidates for a task ID, including legacy formats.
 */
export function taskIdCandidates(taskId: string): string[] {
	const trimmed = taskId.trim();
	if (!trimmed) return [];
	const upper = trimmed.toUpperCase();
	const sequence = parseTaskIdSequence(upper);
	if (sequence === null) return unique([trimmed, upper]);
	return unique([
		trimmed,
		upper,
		formatTaskId(sequence),
		formatLegacyTaskId(sequence),
	]);
}
