import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { GitCache } from "./git-cache.ts";
import { loadGateway } from "./transaction.ts";
import type { WikiProject } from "../domain/shared/types.ts";
import { buildGraph } from "../application/graph.ts";
import { buildLintReport } from "../application/lint.ts";
import { buildRoadmapState, buildStatusState } from "../application/state-builders.ts";
import { parseDoc } from "./doc-parser.ts";
import type { ParsedDoc } from "./doc-parser.ts";

export class CodewikiRebuilder {
	private readonly repoRoot: string;
	private readonly gitCache: GitCache;

	constructor(repoRoot: string) {
		this.repoRoot = repoRoot;
		this.gitCache = new GitCache(repoRoot);
	}

	private findMarkdownFiles(project: WikiProject): string[] {
		const docsRoot = project.docsRoot.replace(/^\.\//, "").replace(/\/$/, "");
		try {
			const raw = execFileSync("git", ["ls-files", "-z", `${docsRoot}/**/*.md`, `${docsRoot}/*.md`], {
				cwd: this.repoRoot,
				encoding: "utf8",
				stdio: "pipe"
			});
			const files = raw.split("\0").filter(Boolean);
			if (files.length > 0) return files;
		} catch {
			// Fallback if not a git repo
		}

		const walk = (dir: string, list: string[] = []) => {
			if (!existsSync(dir)) return list;
			for (const f of readdirSync(dir)) {
				const p = join(dir, f);
				if (statSync(p).isDirectory()) walk(p, list);
				else if (f.endsWith(".md")) list.push(p);
			}
			return list;
		};

		const mdFiles: string[] = [];
		walk(join(this.repoRoot, project.docsRoot), mdFiles);
		return mdFiles.map(p => relative(this.repoRoot, p).replace(/\\/g, "/"));
	}

	private writeRoadmapQueue(project: WikiProject, roadmapState: any): void {
		const roadmapDir = join(this.repoRoot, project.metaRoot, "roadmap");
		if (!existsSync(roadmapDir)) mkdirSync(roadmapDir, { recursive: true });

		const taskIds = Array.isArray(roadmapState?.views?.open_task_ids)
			? roadmapState.views.open_task_ids
			: [];
		const tasks = taskIds
			.map((taskId: string) => roadmapState?.tasks?.[taskId])
			.filter(Boolean)
			.map((task: any) => ({
				id: String(task.id || "").trim(),
				title: String(task.title || "").trim(),
				status: String(task.status || "todo").trim(),
				phase: task.loop?.phase || null,
				priority: String(task.priority || "medium").trim(),
				kind: String(task.kind || "task").trim(),
				summary: String(task.summary || "").trim(),
				context_path: String(task.context_path || `${project.metaRoot}/roadmap/tasks/${task.id}/context.json`).trim(),
				spec_paths: Array.isArray(task.spec_paths) ? task.spec_paths : [],
				code_paths: Array.isArray(task.code_paths) ? task.code_paths : [],
			}));
		writeFileSync(join(roadmapDir, "queue.json"), JSON.stringify({ tasks }, null, 2));
	}

	private loadResearchCollections(project: WikiProject): any[] {
		const collections: any[] = [];
		const root = join(this.repoRoot, project.researchRoot);

		const walk = (dir: string) => {
			if (!existsSync(dir)) return;
			for (const f of readdirSync(dir)) {
				const p = join(dir, f);
				if (statSync(p).isDirectory()) walk(p);
				else if (f.endsWith(".jsonl") && !f.includes("events") && !f.includes("archive")) {
					try {
						const raw = readFileSync(p, "utf8");
						const lines = raw.split(/\r?\n/).filter((l: string) => l.trim().startsWith("{"));
						const entries = lines.map((l: string) => {
							try { return JSON.parse(l); } catch { return null; }
						}).filter(Boolean).map((e: any) => ({
							id: String(e.id || "").trim(),
							title: String(e.title || "").trim(),
							summary: String(e.summary || "").trim(),
							web_link: String(e.web_link || "").trim(),
							updated: String(e.updated || "").trim(),
							tags: (e.tags || []).filter(Boolean).map(String),
							revision: { digest: "dummy" }
						}));
						collections.push({
							path: relative(this.repoRoot, p).replace(/\\/g, "/"),
							entry_count: entries.length,
							entries
						});
					} catch {}
				}
			}
		};
		walk(root);
		return collections;
	}

	public async rebuildAll(): Promise<void> {
		console.log(`[Rebuild] Starting full rebuild for repo: ${this.repoRoot}`);
		
		console.log(`[Rebuild] Warming up git cache...`);
		this.gitCache.prefetchAllBlobOids();

		const configPath = join(this.repoRoot, ".codewiki", "config.json");
		const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
		
		const metaRoot = config.meta_root || ".codewiki";
		const project: WikiProject = {
			root: this.repoRoot,
			label: config.project_name || "Project",
			config,
			docsRoot: config.docs_root || ".codewiki/kb",
			specsRoot: config.specs_root || config.docs_root || ".codewiki/kb",
			researchRoot: config.evidence_root || config.research_root || ".codewiki/evidence",
			indexPath: config.index_path || null,
			roadmapPath: config.roadmap_path || ".codewiki/roadmap.json",
			roadmapDocPath: config.roadmap_doc_path || null,
			metaRoot: metaRoot,
			viewsRoot: config.views_root || ".codewiki/views",
			configPath: ".codewiki/config.json",
			lintPath: join(metaRoot, "lint.json"),
			graphPath: join(metaRoot, "index_graph.json"),
			evidenceRoot: config.evidence_root || ".codewiki/evidence",
			roadmapEventsPath: "",
			eventsPath: "",
			roadmapStatePath: join(metaRoot, "index_graph.json"),
			statusStatePath: join(metaRoot, "index_graph.json"),
		};

		console.log(`[Rebuild] Loading docs...`);
		const mdFiles = this.findMarkdownFiles(project);
		const docs: ParsedDoc[] = [];
		for (const relPath of mdFiles) {
			try {
				docs.push(parseDoc(this.repoRoot, project, resolve(this.repoRoot, relPath)));
			} catch (err) {
				console.error(`[Rebuild] Failed to parse doc: ${relPath}`);
			}
		}

		console.log(`[Rebuild] Loading state JSONs...`);
		const readJson = (file: string, fallback: any) => {
			const p = join(this.repoRoot, file);
			return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
		};
		const readJsonLines = (file: string) => {
			const p = join(this.repoRoot, file);
			if (!existsSync(p)) return [];
			return readFileSync(p, "utf8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
		};

		const roadmapData = readJson(project.roadmapPath, { tasks: {} });
		const roadmapEntries = Object.values(roadmapData.tasks || {}) as any[];
		const archivePath = config.roadmap_retention?.archive_path || `${metaRoot}/roadmap/archive.jsonl`;
		const archivedRoadmapEntries = readJsonLines(archivePath);
		const archivedTaskIds = archivedRoadmapEntries.map((task: any) => String(task.id || "").trim()).filter(Boolean);
		const events: any[] = [];

		const research = this.loadResearchCollections(project);

		console.log(`[Rebuild] Discovering build artifacts...`);
		const builds: { path: string; kind: string; taskId?: string; status?: string; data: any }[] = [];
		const buildsRoot = join(this.repoRoot, ".codewiki", "builds");
		if (existsSync(buildsRoot)) {
			for (const kind of ["feedback", "documentation", "implementation"]) {
				const kindDir = join(buildsRoot, kind);
				if (!existsSync(kindDir)) continue;
				for (const f of readdirSync(kindDir)) {
					if (!f.endsWith(".json")) continue;
					const buildPath = `.codewiki/builds/${kind}/${f}`;
					const data = readJson(buildPath, {});
					const taskId = data.task_id || data.source_feedback_build ? undefined : undefined;
					builds.push({
						path: buildPath,
						kind: `${kind}_build`,
						taskId: data.task_id || data.taskId || undefined,
						status: data.status,
						data,
					});
				}
			}
		}

		console.log(`[Rebuild] Discovering validation reports...`);
		const validations: { path: string; taskId?: string; verdict?: string; data?: any }[] = [];
		const validationRoot = join(this.repoRoot, ".codewiki", "validation");
		if (existsSync(validationRoot)) {
			const walk = (dir: string) => {
				for (const f of readdirSync(dir)) {
					const p = join(dir, f);
					if (statSync(p).isDirectory()) { walk(p); continue; }
					if (!f.endsWith(".json")) continue;
					const relPath = relative(this.repoRoot, p).replace(/\\/g, "/");
					const vdata = readJson(relPath, {});
					validations.push({
						path: relPath,
						taskId: vdata.taskId || vdata.task_id || undefined,
						verdict: vdata.verdict,
						data: vdata,
					});
				}
			};
			walk(validationRoot);
		}

		console.log(`[Rebuild] Discovering test files...`);
		const testFiles: string[] = [];
		const scriptsDir = join(this.repoRoot, "scripts");
		if (existsSync(scriptsDir)) {
			for (const f of readdirSync(scriptsDir)) {
				const lower = f.toLowerCase();
				if ((lower.includes("test") || lower.includes("smoke") || lower.includes("benchmark") || lower.includes("check")) && (f.endsWith(".mjs") || f.endsWith(".ts") || f.endsWith(".js"))) {
					testFiles.push(`scripts/${f}`);
				}
			}
		}

		console.log(`[Rebuild] Graph and Lint dependencies resolving...`);

		const graph = buildGraph({ project, docs, research, roadmapEntries, gitCache: this.gitCache, builds, validations, testFiles });
		const lintReport = buildLintReport(this.repoRoot, project, docs, roadmapEntries, research, { builds, validations, archivedTaskIds });
		
		console.log(`[Rebuild] Building UI state...`);
		const roadmapState = buildRoadmapState(project, roadmapEntries, graph, lintReport, events);
		
		const previousStatusPath = join(this.repoRoot, project.statusStatePath);
		const previousStatus = existsSync(previousStatusPath) ? JSON.parse(readFileSync(previousStatusPath, "utf8")) : {};
		const statusState = buildStatusState(project, this.repoRoot, this.gitCache, docs, graph, roadmapEntries, lintReport, roadmapState, events, previousStatus);
		
		const metaRootDir = join(this.repoRoot, metaRoot);
		if (!existsSync(metaRootDir)) mkdirSync(metaRootDir, { recursive: true });

		const indexGraph = {
			...graph,
			lenses: {
				lint: lintReport,
				roadmap: roadmapState,
				status: statusState,
			},
		};
		writeFileSync(join(metaRootDir, "index_graph.json"), JSON.stringify(indexGraph, null, 2));
		this.writeRoadmapQueue(project, roadmapState);

		console.log(`[Rebuild] Engine pipeline completed successfully!`);
	}
}

export async function rebuildMain(args: string[]) {
	const repo = args[0] || process.cwd();
	const builder = new CodewikiRebuilder(repo);
	await builder.rebuildAll();
}
