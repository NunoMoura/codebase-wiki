import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WikiProject } from "../core/types";
import { formatError, unique } from "../core/utils";

const execFileAsync = promisify(execFile);

export async function runConfiguredOrDefaultRebuild(
	project: WikiProject,
): Promise<void> {
	const configuredCommand = sanitizeCommand(
		project.config.codewiki?.rebuild_command,
	);

	if (configuredCommand) {
		const commands = uniqueCommands([
			configuredCommand,
			...pythonAliasFallback(configuredCommand),
		]);
		let lastError: unknown;
		for (const command of commands) {
			try {
				await execFileAsync(command[0], command.slice(1), {
					cwd: project.root,
					timeout: 120_000,
				});
				return;
			} catch (error) {
				lastError = error;
			}
		}
		throw new Error(`Rebuild failed: ${formatError(lastError)}`);
	}

	try {
		const { CodewikiRebuilder } = await import("../engine/rebuild");
		await new CodewikiRebuilder(project.root).rebuildAll();
	} catch (error) {
		throw new Error(`Default rebuild failed: ${formatError(error)}`);
	}
}

function sanitizeCommand(cmd: string | string[] | undefined): string[] | null {
	if (!cmd) return null;
	if (Array.isArray(cmd)) return cmd.filter(Boolean);
	const tokens = cmd.trim().split(/\s+/).filter(Boolean);
	return tokens.length > 0 ? tokens : null;
}

function pythonAliasFallback(cmd: string[]): string[][] {
	if (cmd[0] === "python3") return [["python", ...cmd.slice(1)]];
	if (cmd[0] === "python") return [["python3", ...cmd.slice(1)]];
	return [];
}

function uniqueCommands(cmds: string[][]): string[][] {
	const seen = new Set<string>();
	const result: string[][] = [];
	for (const cmd of cmds) {
		const key = cmd.join(" ");
		if (!seen.has(key)) {
			seen.add(key);
			result.push(cmd);
		}
	}
	return result;
}
