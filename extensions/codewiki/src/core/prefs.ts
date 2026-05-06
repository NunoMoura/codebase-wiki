import { resolve } from "node:path";
import { homedir } from "node:os";
import {
	type StatusDockPrefs,
	type StatusDockMode,
	type StatusDockDensity,
	STATUS_DOCK_MODE_VALUES,
	STATUS_DOCK_DENSITY_VALUES,
} from "./types";
import type { CodewikiFileStorePort } from "./ports";

export const STATUS_DOCK_PREFS_VERSION = 1;
export const STATUS_DOCK_PREFS_ENV = "PI_CODEWIKI_STATUS_PREFS_PATH";

export function defaultStatusDockPrefs(): StatusDockPrefs {
	return {
		version: STATUS_DOCK_PREFS_VERSION,
		mode: "auto",
		density: "standard",
	};
}

export function resolveStatusDockPrefsPath(): string {
	const env = process.env[STATUS_DOCK_PREFS_ENV];
	if (env) return resolve(env);
	return resolve(homedir(), ".pi", "codewiki-status-prefs.json");
}

export async function readStatusDockPrefs(
	files: CodewikiFileStorePort = defaultFileStore(),
): Promise<StatusDockPrefs> {
	const path = resolveStatusDockPrefsPath();
	if (!(await files.pathExists(path))) return defaultStatusDockPrefs();
	try {
		const raw = await files.readJson<Partial<StatusDockPrefs>>(path);
		const mode = STATUS_DOCK_MODE_VALUES.includes(raw.mode as StatusDockMode)
			? (raw.mode as StatusDockMode)
			: "auto";
		const density = STATUS_DOCK_DENSITY_VALUES.includes(
			raw.density as StatusDockDensity,
		)
			? (raw.density as StatusDockDensity)
			: "standard";
		const pinnedRepoPath =
			typeof raw.pinnedRepoPath === "string" && raw.pinnedRepoPath.trim()
				? raw.pinnedRepoPath.trim()
				: undefined;
		const lastRepoPath =
			typeof raw.lastRepoPath === "string" && raw.lastRepoPath.trim()
				? raw.lastRepoPath.trim()
				: undefined;
		return {
			version: STATUS_DOCK_PREFS_VERSION,
			mode,
			density,
			pinnedRepoPath,
			lastRepoPath,
		};
	} catch {
		return defaultStatusDockPrefs();
	}
}

export async function writeStatusDockPrefs(
	prefs: StatusDockPrefs,
	files: CodewikiFileStorePort = defaultFileStore(),
): Promise<void> {
	const path = resolveStatusDockPrefsPath();
	await files.writeText(
		path,
		`${JSON.stringify({ ...prefs, version: STATUS_DOCK_PREFS_VERSION }, null, 2)}\n`,
	);
}

function defaultFileStore(): CodewikiFileStorePort {
	return {
		readText: async (path) => (await import("../infrastructure/filesystem")).readText(path),
		writeText: async (path, content) => (await import("../infrastructure/filesystem")).writeText(path, content),
		readJson: async (path) => (await import("../infrastructure/filesystem")).readJson(path),
		maybeReadJson: async (path) => (await import("../infrastructure/filesystem")).maybeReadJson(path),
		pathExists: async (path) => (await import("../infrastructure/filesystem")).pathExists(path),
		isDirectory: async (path) => (await import("../infrastructure/filesystem")).isDirectory(path),
	};
}
