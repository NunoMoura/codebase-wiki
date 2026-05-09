import { resolve, dirname, basename } from "node:path";
import type { CodewikiFileStore } from "../infrastructure/file-store";
import type {
	WikiProject,
	ResolvedStatusDockProject,
	DocsConfig,
	RoadmapTaskRecord,
	TaskSessionLinkRecord,
	StatusDockPrefs,
	StatusDockMode,
} from "../domain/shared/types";
import {
	nowIso,
	unique,
	formatError,
} from "../domain/shared/utils";
import {
	readStatusDockPrefs,
	writeStatusDockPrefs,
} from "../infrastructure/status-dock-prefs";
import { nodeFileStore } from "../infrastructure/file-store";

export interface CodewikiUiPort {
	setStatus(key: string, value: string | undefined): void;
	input?(prompt: string, initial?: string): Promise<string>;
}

export interface CodewikiContextPort {
	cwd: string;
	workspaceRoot?: string;
	ui: CodewikiUiPort;
}

/**
 * Load a wiki project from a root directory.
 */
export async function loadProject(
	root: string,
	files: CodewikiFileStore = nodeFileStore(),
): Promise<WikiProject> {
	const configPath = resolve(root, ".codewiki/config.json");
	let config: DocsConfig = {};
	try {
		config = await files.readJson<DocsConfig>(configPath);
	} catch (error) {
		throw new Error(`No .codewiki/config.json found at ${configPath}. ${formatError(error)}`);
	}

	const metaRoot = config.meta_root || ".codewiki";
	const viewsRoot = config.views_root || ".codewiki/views";
	const roadmapEventsPath = "";

	return {
		root,
		config,
		docsRoot: config.docs_root || ".codewiki/kb",
		specsRoot: config.specs_root || config.docs_root || ".codewiki/kb",
		evidenceRoot: config.evidence_root || ".codewiki/evidence",
		researchRoot: config.research_root || config.evidence_root || ".codewiki/evidence",
		indexPath: config.index_path || null,
		roadmapPath: config.roadmap_path || ".codewiki/roadmap.json",
		roadmapDocPath: config.roadmap_doc_path || null,
		roadmapEventsPath,
		metaRoot,
		viewsRoot,
		label: config.project_name || basename(root),
		configPath,
		graphPath: resolve(root, metaRoot, "index_graph.json"),
		lintPath: resolve(root, metaRoot, "index_graph.json"),
		roadmapStatePath: resolve(root, metaRoot, "index_graph.json"),
		statusStatePath: resolve(root, metaRoot, "index_graph.json"),
		eventsPath: "",
	};
}

/**
 * Find the wiki root by searching upwards for a .codewiki directory.
 */
export async function findWikiRoot(
	ctx: CodewikiContextPort,
	files: CodewikiFileStore = nodeFileStore(),
): Promise<string | null> {
	let current = ctx.cwd || ctx.workspaceRoot;
	if (!current) return null;
	while (current !== "/") {
		const wikiDir = resolve(current, ".codewiki");
		if (await files.isDirectory(wikiDir)) return current;
		current = dirname(current);
	}
	return null;
}

/**
 * Load the project for the current extension context.
 */
export async function maybeLoadProject(
	ctxOrPath: CodewikiContextPort | string,
	files: CodewikiFileStore = nodeFileStore(),
): Promise<WikiProject | null> {
	let wikiRoot: string | null = null;
	if (typeof ctxOrPath === "string") {
		wikiRoot = ctxOrPath;
	} else {
		wikiRoot = await findWikiRoot(ctxOrPath, files);
	}
	if (!wikiRoot) return null;
	return loadProject(wikiRoot, files);
}

/**
 * Append a task session event to the events file.
 */
export async function appendTaskSessionEvent(
	project: WikiProject,
	task: RoadmapTaskRecord,
	link: TaskSessionLinkRecord,
	sessionId: string,
): Promise<void> {
    const { appendProjectEvent } = await import("../core/roadmap");
	await appendProjectEvent(project, {
		ts: nowIso(),
		kind: "roadmap_task_session_link",
		taskId: task.id,
		title: task.title,
		action: link.action,
		summary: link.summary,
		files_touched: link.filesTouched,
		spawnedTaskIds: link.spawnedTaskIds,
		session_id: sessionId,
	});
}

/**
 * Normalize a relative path.
 */
export function normalizeRelativePath(path: string): string {
	return path.replace(/^\.\//, "").replace(/\/$/, "");
}

/**
 * Normalize a relative path if it's not null/undefined.
 */
export function optionalRelativePath(path: string | undefined): string | undefined {
	return path ? normalizeRelativePath(path) : undefined;
}

/**
 * Reload the project configuration.
 */
export async function reloadProjectConfig(project: WikiProject): Promise<WikiProject> {
	return loadProject(project.root);
}

export const DEFAULT_DOCS_ROOT = ".codewiki/kb";
export const DEFAULT_SPECS_ROOT = ".codewiki/kb";
export const DEFAULT_EVIDENCE_ROOT = ".codewiki/evidence";
export const DEFAULT_INDEX_PATH = "";
export const DEFAULT_ROADMAP_PATH = ".codewiki/roadmap.json";
export const DEFAULT_ROADMAP_DOC_PATH = "";
export const DEFAULT_ROADMAP_EVENTS_PATH = "";
export const DEFAULT_META_ROOT = ".codewiki";

export async function rememberStatusDockProject(
	project: WikiProject,
	prefs: StatusDockPrefs | null = null,
): Promise<void> {
	const current = prefs ?? (await readStatusDockPrefs());
	if (current.lastRepoPath === project.root) return;
	await writeStatusDockPrefs({ ...current, lastRepoPath: project.root });
}

export async function resolveStatusDockProject(
	ctx: CodewikiContextPort,
	options?: { allowWhenOff?: boolean },
): Promise<ResolvedStatusDockProject | null> {
	const { maybeReadStatusState } = await import("../core/state");
	const prefs = await readStatusDockPrefs();
	if (prefs.mode === "off" && !options?.allowWhenOff) return null;
	const localProject = await maybeLoadProject(ctx.cwd);
	if (localProject) {
		await rememberStatusDockProject(localProject, prefs);
		return {
			...localProject,
			project: localProject,
			statusState: await maybeReadStatusState(localProject.statusStatePath),
			source: "cwd",
		};
	}
	const fallbackRoots = unique([
		...(prefs.mode === "pin" && prefs.pinnedRepoPath
			? [prefs.pinnedRepoPath]
			: []),
		...(prefs.lastRepoPath ? [prefs.lastRepoPath] : []),
	]);
	for (const root of fallbackRoots) {
		const fallbackProject = await maybeLoadProject(root);
		if (!fallbackProject) continue;
		await rememberStatusDockProject(fallbackProject, prefs);
		return {
			...fallbackProject,
			project: fallbackProject,
			statusState: await maybeReadStatusState(fallbackProject.statusStatePath),
			source: "pinned",
		};
	}
	return null;
}

export async function resolveToolProject(
	startDir: string,
	repoPath: string | undefined,
	toolName: string,
): Promise<WikiProject> {
	if (repoPath) {
		const requestedPath = resolve(startDir, repoPath);
		try {
			const project = await loadProject(requestedPath);
			await rememberStatusDockProject(project);
			return project;
		} catch (error) {
			throw new Error(
				`${toolName}: could not resolve repoPath ${requestedPath}. ${formatError(error)}`,
			);
		}
	}

	try {
		const project = await loadProject(startDir);
		await rememberStatusDockProject(project);
		return project;
	} catch {
		const prefs = await readStatusDockPrefs();
		const fallbackRoots = unique([
			...(prefs.mode === "pin" && prefs.pinnedRepoPath
				? [prefs.pinnedRepoPath]
				: []),
			...(prefs.lastRepoPath ? [prefs.lastRepoPath] : []),
		]);
		for (const root of fallbackRoots) {
			const project = await maybeLoadProject(root);
			if (!project) continue;
			await rememberStatusDockProject(project, prefs);
			return project;
		}
		throw new Error(
			[
				`${toolName}: no repo-local wiki found from ${startDir}.`,
				"codewiki tools are available globally, but each run mutates one repo-local wiki.",
				`Retry with repoPath set to the target repo root, or any path inside that repo.`,
			].join(" "),
		);
	}
}

export async function resolveCommandProject(
	ctx: CodewikiContextPort,
	pathArg: string | null,
	commandName: string,
): Promise<WikiProject> {
	const { findWikiRootsBelow } = await import("../../project-root");
	if (pathArg) {
		const requestedPath = resolve(ctx.cwd, pathArg);
		try {
			const project = await loadProject(requestedPath);
			await rememberStatusDockProject(project);
			return project;
		} catch (error) {
			throw new Error(
				`${commandName}: could not resolve repo path ${requestedPath}. ${formatError(error)}`,
			);
		}
	}

	try {
		const project = await loadProject(ctx.cwd);
		await rememberStatusDockProject(project);
		return project;
	} catch {
		const candidates = await findWikiRootsBelow(ctx.cwd);
		if (candidates.length > 0) {
			const pickedRoot = await pickCommandProjectRoot(
				ctx,
				commandName,
				candidates,
			);
			if (pickedRoot) {
				const project = await loadProject(pickedRoot);
				await rememberStatusDockProject(project);
				return project;
			}
		}
		throw new Error(
			`${commandName}: No repo-local wiki found from ${ctx.cwd}. CodeWiki commands may be loaded globally, but each run targets one repo-local wiki. Use /wiki-bootstrap first, work inside a repo with .codewiki/config.json, or pass an explicit repo path like /${commandName} /path/to/repo.`,
		);
	}
}

async function pickCommandProjectRoot(
	ctx: CodewikiContextPort,
	commandName: string,
	candidates: string[],
): Promise<string | null> {
	if (candidates.length === 1) return candidates[0];
	const picked = await ctx.ui.input(
		`${commandName}: Multiple wikis found below current directory. Pick one:`,
		candidates[0],
	);
	return picked || null;
}
