import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { GitCache } from "./git-cache";
import { loadGateway } from "./transaction";
import { WikiProject } from "../core/types";
import { buildGraph } from "./graph";
import { buildLintReport } from "./lint";
import { buildRoadmapState, buildStatusState } from "./state";
import { parseDoc, ParsedDoc } from "./parser";

export class CodewikiRebuilder {
	private readonly repoRoot: string;
	private readonly gitCache: GitCache;

	constructor(repoRoot: string) {
		this.repoRoot = repoRoot;
		this.gitCache = new GitCache(repoRoot);
	}

	private findMarkdownFiles(project: WikiProject): string[] {
		try {
			const raw = execFileSync("git", ["ls-files", "-z", "*.md"], {
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
		walk(join(this.repoRoot, project.viewsRoot), mdFiles);
		walk(join(this.repoRoot, project.researchRoot), mdFiles);
		return mdFiles.map(p => relative(this.repoRoot, p).replace(/\\/g, "/"));
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

		const configPath = join(this.repoRoot, ".wiki", "config.json");
		const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
		
		const metaRoot = config.meta_root || ".wiki";
		const project: WikiProject = {
			root: this.repoRoot,
			label: config.project_name || "Project",
			config,
			docsRoot: config.docs_root || ".wiki/knowledge",
			specsRoot: config.specs_root || config.docs_root || ".wiki/knowledge",
			researchRoot: config.evidence_root || config.research_root || ".wiki/evidence",
			indexPath: config.index_path || null,
			roadmapPath: config.roadmap_path || ".wiki/roadmap.json",
			roadmapDocPath: config.roadmap_doc_path || null,
			metaRoot: metaRoot,
			viewsRoot: config.views_root || ".wiki/views",
			configPath: ".wiki/config.json",
			lintPath: join(metaRoot, "lint.json"),
			graphPath: join(metaRoot, "graph.json"),
			evidenceRoot: config.evidence_root || ".wiki/evidence",
			eventsPath: config.events_path || ".wiki/events.jsonl",
			roadmapEventsPath: config.roadmap_events_path || ".wiki/roadmap-events.jsonl",
			roadmapStatePath: join(metaRoot, "roadmap-state.json"),
			statusStatePath: join(metaRoot, "status-state.json"),
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
		const events = readJsonLines(project.eventsPath);
		
		const research = this.loadResearchCollections(project);
		
		console.log(`[Rebuild] Graph and Lint dependencies resolving...`);
		
		const graph = buildGraph({ project, docs, research, roadmapEntries, gitCache: this.gitCache });
		const lintReport = buildLintReport(this.repoRoot, project, docs, roadmapEntries, research);
		
		console.log(`[Rebuild] Building UI state...`);
		const roadmapState = buildRoadmapState(project, roadmapEntries, graph, lintReport, events);
		
		const previousStatusPath = join(this.repoRoot, project.statusStatePath);
		const previousStatus = existsSync(previousStatusPath) ? JSON.parse(readFileSync(previousStatusPath, "utf8")) : {};
		const statusState = buildStatusState(project, this.repoRoot, this.gitCache, docs, graph, roadmapEntries, lintReport, roadmapState, events, previousStatus);
		
		const metaRootDir = join(this.repoRoot, metaRoot);
		if (!existsSync(metaRootDir)) mkdirSync(metaRootDir, { recursive: true });
		
		const legacyRoadmapDir = join(metaRootDir, "roadmap");
		if (!existsSync(legacyRoadmapDir)) mkdirSync(legacyRoadmapDir, { recursive: true });
		
		writeFileSync(join(metaRootDir, "roadmap-state.json"), JSON.stringify(roadmapState, null, 2));
		writeFileSync(join(metaRootDir, "status-state.json"), JSON.stringify(statusState, null, 2));
		writeFileSync(join(metaRootDir, "graph.json"), JSON.stringify(graph, null, 2));
		writeFileSync(join(metaRootDir, "lint.json"), JSON.stringify(lintReport, null, 2));
		writeFileSync(join(legacyRoadmapDir, "index.json"), JSON.stringify(roadmapState, null, 2));
		writeFileSync(join(legacyRoadmapDir, "state.json"), JSON.stringify(roadmapState, null, 2));

		const { writeV2Views } = await import("./views");
		writeV2Views(this.repoRoot, docs, research, graph, roadmapEntries, lintReport, roadmapState, statusState, events);

		console.log(`[Rebuild] Engine pipeline completed successfully!`);
	}
}

export async function rebuildMain(args: string[]) {
	const repo = args[0] || process.cwd();
	const builder = new CodewikiRebuilder(repo);
	await builder.rebuildAll();
}
