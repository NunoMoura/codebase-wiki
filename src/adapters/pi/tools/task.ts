import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CodewikiTaskToolInput, WikiProject } from "../../../domain/shared/types.ts";
import { executeCodewikiTaskTool } from "../../../application/tools/task.ts";
import { piTaskPorts } from "./ports.ts";

/** Implementation of the codewiki_task tool. */
export async function executeCodewikiTask(
	_pi: ExtensionAPI,
	project: WikiProject,
	_ctx: ExtensionContext,
	input: CodewikiTaskToolInput,
) {
	return executeCodewikiTaskTool(project, input, piTaskPorts());
}
