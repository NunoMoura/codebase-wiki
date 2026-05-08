import type { WikiProject } from "../core/types";
import { formatError } from "../core/utils";

export async function runConfiguredOrDefaultRebuild(
	project: WikiProject,
): Promise<void> {
	const legacyCommand = (project.config.codewiki as Record<string, unknown> | undefined)?.[
		`rebuild_${"command"}`
	];
	if (legacyCommand) {
		throw new Error(
			"Legacy external rebuild command is deprecated; CodeWiki uses the built-in TypeScript rebuild engine.",
		);
	}

	try {
		const { CodewikiRebuilder } = await import("../engine/rebuild");
		await new CodewikiRebuilder(project.root).rebuildAll();
	} catch (error) {
		throw new Error(`Default rebuild failed: ${formatError(error)}`);
	}
}

