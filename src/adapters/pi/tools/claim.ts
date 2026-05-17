import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CodewikiClaimToolInput, WikiProject } from "../../../domain/shared/types.ts";
import { executeCodewikiClaimTool } from "../../../application/tools/claim.ts";
import { stableAgentName } from "../../../application/state-builders.ts";

/** Implementation of the codewiki_claim compatibility tool. */
export async function executeCodewikiClaim(
	_pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiClaimToolInput,
) {
	const sessionId = String(ctx.sessionManager?.getSessionId?.() || "session-unknown").trim() || "session-unknown";
	const result = await executeCodewikiClaimTool(project, input, { sessionId, agentName: stableAgentName(sessionId) });
	ctx.ui.setStatus?.("codewiki-artifacts", result.statusText);
	return result;
}
