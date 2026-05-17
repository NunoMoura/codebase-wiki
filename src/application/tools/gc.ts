import type { CodewikiGcToolInput, WikiProject } from "../../domain/shared/types.ts";
import { runCodewikiGc } from "../gc.ts";
import { runRebuild } from "../state-artifacts.ts";

export async function executeCodewikiGcTool(
	project: WikiProject,
	input: CodewikiGcToolInput,
) {
	const result = await runCodewikiGc(project, input);
	if (result.changed && (input.refresh ?? true)) await runRebuild(project);
	return {
		summary: `codewiki gc: ${result.status} (${result.summary})`,
		result,
	};
}
