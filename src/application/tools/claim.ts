import type { CodewikiClaimToolInput, WikiProject } from "../../domain/shared/types.ts";
import { mutateChangeClaims } from "../claims.ts";
import { runRebuild } from "../state-artifacts.ts";

export interface CodewikiClaimToolContext {
	sessionId: string;
	agentName: string;
}

export async function executeCodewikiClaimTool(
	project: WikiProject,
	input: CodewikiClaimToolInput,
	context: CodewikiClaimToolContext,
) {
	const result = await mutateChangeClaims(project, input, context);
	if ((input.refresh ?? true) && result.changed) await runRebuild(project);
	const conflictCount = result.conflicts.filter((conflict) => conflict.kind === "conflict").length;
	const warningCount = result.conflicts.filter((conflict) => conflict.kind === "warning").length;
	const waiterCount = result.waiters?.length || 0;
	const readyWaiters = (result.waiters || []).filter((waiter) => waiter.status === "ready").length;
	return {
		action: input.action,
		changed: result.changed,
		claim: result.claim,
		waiter: result.waiter,
		claims: result.claims,
		waiters: result.waiters,
		conflicts: result.conflicts,
		summary: result.summary,
		statusText: result.claims.length > 0 || waiterCount > 0
			? `${result.claims.length} artifact(s) in-use, ${waiterCount} wait(s), ${readyWaiters} ready, ${conflictCount} conflict(s), ${warningCount} warning(s)`
			: undefined,
	};
}
