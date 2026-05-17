import type { CodewikiValidationReportInput, WikiProject } from "../../domain/shared/types.ts";
import { writeValidationReport } from "../builds.ts";
import { runRebuild } from "../state-artifacts.ts";

export async function executeCodewikiValidationTool(
	project: WikiProject,
	input: CodewikiValidationReportInput,
) {
	const result = await writeValidationReport(project, input);
	if (input.refresh ?? true) await runRebuild(project);
	return {
		summary: `codewiki validation: wrote ${result.path}`,
		result,
	};
}
