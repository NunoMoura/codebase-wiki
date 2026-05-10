import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type {
	CodewikiClaimToolInput,
	WikiProject,
} from "../../../domain/shared/types.ts";
import { mutateChangeClaims } from "../../../application/claims.ts";
import { runRebuild } from "../../../application/state-artifacts.ts";
import { stableAgentName } from "../../../application/state-builders.ts";

/**
 * Implementation of the codewiki_claim tool.
 */
export async function executeCodewikiClaim(
	pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiClaimToolInput,
) {
	const sessionId = String(ctx.sessionManager?.getSessionId?.() || "session-unknown").trim() || "session-unknown";
	const agentName = stableAgentName(sessionId);
	const result = await mutateChangeClaims(project, input, { sessionId, agentName });
	if ((input.refresh ?? true) && result.changed) await runRebuild(project);
	const conflictCount = result.conflicts.filter((conflict) => conflict.kind === "conflict").length;
	const warningCount = result.conflicts.filter((conflict) => conflict.kind === "warning").length;
	void pi;
	ctx.ui.setStatus?.(
		"codewiki-claims",
		result.claims.length > 0
			? `${result.claims.length} claim(s), ${conflictCount} conflict(s), ${warningCount} warning(s)`
			: undefined,
	);
	return {
		action: input.action,
		changed: result.changed,
		claim: result.claim,
		claims: result.claims,
		conflicts: result.conflicts,
		summary: result.summary,
	};
}
