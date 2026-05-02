import { readFileSync } from "node:fs";
import { dirname, join, basename, posix } from "node:path";
import { fileURLToPath } from "node:url";

export interface StarterBoundary {
	codePath: string;
	slug: string;
	title: string;
}

export interface StarterBrownfieldHints {
	boundaries: StarterBoundary[];
	repoMarkdownGlobs: string[];
	codeGlobs: string[];
}

export interface StarterTemplateInput {
	projectName: string;
	date: string;
	brownfieldHints?: StarterBrownfieldHints;
}

export function starterDirectories(): string[] {
	return [
		".wiki/evidence",
		".wiki/knowledge/product",
		".wiki/knowledge/clients/surfaces",
		".wiki/knowledge/system",
		".wiki/sources",
		"scripts",
	];
}

export function starterFiles(
	input: StarterTemplateInput,
): Record<string, string> {
	const projectName = input.projectName.trim() || basename(process.cwd());
	const date = input.date;
	const brownfieldHints = input.brownfieldHints ?? {
		boundaries: [],
		repoMarkdownGlobs: [],
		codeGlobs: [],
	};
	const files: Record<string, string> = {
		".wiki/config.json": configJson(projectName, date, brownfieldHints),
		".wiki/events.jsonl": bootstrapEvent(projectName),
		".wiki/sources/.gitkeep": "",
		"scripts/rebuild_docs_meta.py": rebuildScript(),
		".wiki/knowledge/product/overview.md": productSpecDoc(projectName, date),
		".wiki/knowledge/clients/overview.md": uxOverviewDoc(projectName, date),
		".wiki/knowledge/clients/surfaces/roadmap.md": uxRoadmapSurfaceDoc(
			projectName,
			date,
		),
		".wiki/knowledge/clients/surfaces/status-panel.md": uxStatusPanelDoc(
			projectName,
			date,
		),
		".wiki/knowledge/system/overview.md": systemSpecDoc(
			projectName,
			date,
			brownfieldHints.boundaries,
		),
		".wiki/knowledge/system/runtime/overview.md": runtimePolicyDoc(
			projectName,
			date,
		),
		".wiki/evidence/inspiration.jsonl": researchJsonl(projectName, date),
		".wiki/roadmap.json": roadmapJson(projectName, date),
	};

	for (const boundary of brownfieldHints.boundaries) {
		files[`.wiki/knowledge/system/${boundary.slug}/overview.md`] =
			boundarySpecDoc(projectName, date, boundary);
	}

	return files;
}

function configJson(
	projectName: string,
	date: string,
	brownfieldHints: StarterBrownfieldHints,
): string {
	const repoMarkdown = uniqueStrings(
		brownfieldHints.repoMarkdownGlobs.length
			? brownfieldHints.repoMarkdownGlobs
			: ["README.md", "src/**/README.md", "backend/**/README.md"],
	);
	const codeGlobs = uniqueStrings(
		brownfieldHints.codeGlobs.length
			? brownfieldHints.codeGlobs
			: ["src/**", "app/**", "backend/**", "server/**"],
	);
	const indexTitle = projectName.toLowerCase().endsWith("wiki")
		? `${projectName} Index`
		: `${projectName} Wiki Index`;

	return (
		JSON.stringify(
			{
				version: 2,
				project_name: projectName,
				template: {
					name: "codewiki-starter",
					version: 1,
					generated_on: date,
				},
				index_title: indexTitle,
				docs_root: ".wiki/knowledge",
				specs_root: ".wiki/knowledge",
				evidence_root: ".wiki/evidence",
				roadmap_path: ".wiki/roadmap.json",
				roadmap_events_path: ".wiki/roadmap-events.jsonl",
				roadmap_retention: {
					closed_task_limit: 50,
					archive_path: ".wiki/roadmap-archive.jsonl",
					compress_archive: false,
				},
				meta_root: ".wiki",
				views_root: ".wiki/views",
				sources_root: ".wiki/sources",
				generated_files: [
					".wiki/graph.json",
					".wiki/lint.json",
					".wiki/roadmap-state.json",
					".wiki/status-state.json",
					".wiki/views/graph.json",
					".wiki/views/lint.json",
					".wiki/views/roadmap-state.json",
					".wiki/views/status-state.json",
					".wiki/views/roadmap/index.json",
					".wiki/views/roadmap/state.json",
				],
				lint: {
					repo_markdown: repoMarkdown,
					forbidden_headings: [
						"## Purpose",
						"## When To Read",
						"## Content",
						"## Summary",
						"## How To Use This Doc",
					],
					word_count_warn: 1600,
					word_count_exempt: [],
				},
				codewiki: {
					name: `${projectName} codebase wiki`,
					rebuild_command: ["python", "scripts/rebuild_docs_meta.py"],
					gateway: {
						enabled: true,
						mode: "read-only",
						allow_paths: [
							".wiki/knowledge/**",
							".wiki/roadmap/tasks/**",
							".wiki/evidence/**",
							".wiki/graph.json",
							".wiki/status-state.json",
							".wiki/roadmap-state.json",
							".wiki/views/**",
							".wiki/roadmap.json",
							".wiki/roadmap-events.jsonl",
							".wiki/events.jsonl",
						],
						write_paths: [".wiki/knowledge/**", ".wiki/evidence/**"],
						generated_readonly_paths: [
							".wiki/graph.json",
							".wiki/lint.json",
							".wiki/status-state.json",
							".wiki/roadmap-state.json",
							".wiki/roadmap/**",
							".wiki/views/**",
						],
						deny_paths: ["**/.env*", "**/*secret*", ".wiki/sources/private/**"],
						network: false,
						max_stdout_bytes: 12000,
						max_read_bytes: 200000,
						max_write_bytes: 50000,
					},
					runtime: {
						adapter: "codewiki-gateway-v1",
						transaction_schema: "codewiki.transaction.v1",
						future_executor: "think-code",
						notes:
							"codewiki owns .wiki semantics; generic sandbox execution may be delegated to think-code when available.",
					},
					self_drift_scope: {
						include: [
							".wiki/knowledge/**/*.md",
							".wiki/roadmap.json",
							".wiki/evidence/**",
						],
						exclude: [],
					},
					code_drift_scope: {
						docs: [".wiki/knowledge/**/*.md"],
						repo_docs: repoMarkdown,
						code: codeGlobs,
					},
				},
			},
			null,
			2,
		) + "\n"
	);
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)].filter(Boolean);
}

function bootstrapEvent(projectName: string): string {
	return (
		JSON.stringify({
			ts: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
			kind: "bootstrap",
			title: "Bootstrapped simplified codebase wiki",
			summary: `Created starter intent-first wiki and machine-managed .wiki contract for ${projectName}.`,
		}) + "\n"
	);
}

function productSpecDoc(projectName: string, date: string): string {
	return [
		"---",
		"id: spec.product",
		"title: Product",
		"state: active",
		`summary: Product intent, users, and value boundaries for ${projectName}.`,
		"owners:",
		"- product",
		`updated: '${date}'`,
		"---",
		"",
		"# Product",
		"",
		`## Intent`,
		"",
		`Describe what ${projectName} exists to do, who it serves, and which user outcomes matter most.`,
		"",
		"## Users",
		"",
		"- primary users",
		"- operator or maintainer users",
		"- agent workflows that depend on this project",
		"",
		"## Success criteria",
		"",
		"- user intent is explicit before implementation expands",
		"- architecture and client surfaces stay grounded in product goals",
		"- roadmap reflects approved delta from intent to current code",
		"- Pi sessions can resume task work cleanly because sessions link back to roadmap tasks",
		"",
		"## Goal quality rule",
		"",
		"Each foundational spec should define clear goals, success signals, non-goals, and verification expectations so drift can be measured instead of guessed.",
		"",
		"## Non-goals",
		"",
		"- duplicated narrative across many docs",
		"- stale historical buckets mixed with live design",
		"- manual roadmap bookkeeping as the primary user workflow",
		"",
		"## Related docs",
		"",
		"- [Clients Overview](../clients/overview.md)",
		"- [System Overview](../system/overview.md)",
		"",
	].join("\n");
}

function uxOverviewDoc(projectName: string, date: string): string {
	return [
		"---",
		"id: spec.clients.overview",
		"title: Clients Overview",
		"state: active",
		`summary: User-facing workflow and status-surface expectations for ${projectName}.`,
		"owners:",
		"- design",
		`updated: '${date}'`,
		"---",
		"",
		"# Clients Overview",
		"",
		"## Core experience",
		"",
		`Describe how users author intent in ${projectName}, how the system validates that intent, and how Pi should surface next actions without forcing users into raw machine files.`,
		"",
		"## Primary flows",
		"",
		"- shape product intent before code drifts too far",
		"- define client flows and surfaces that explain expected user interaction",
		"- inspect evidence and inferred delta inside Pi",
		"- approve tracked work into roadmap state",
		"- resume implementation from tracked roadmap focus",
		"",
		"## Goal quality rule",
		"",
		"Client specs should describe not only desired behavior, but also how success will be recognized, which behavior is out of scope, and what evidence should be reviewed before work is considered done.",
		"",
		"## Surface rules",
		"",
		"- keep canonical knowledge under `.wiki/knowledge/`",
		"- keep machine-managed sources, roadmap, evidence, graph, and views under `.wiki/`",
		"- make `Alt+W` the primary control room for status, inferred delta, and tracked work",
		"- keep the optional summary line short enough to coexist with other Pi extension statuses",
		"",
		"## Related docs",
		"",
		"- [Product](../product/overview.md)",
		"- [Roadmap Surface](surfaces/roadmap.md)",
		"- [Status Panel](surfaces/status-panel.md)",
		"- [System Overview](../system/overview.md)",
		"",
	].join("\n");
}

function uxRoadmapSurfaceDoc(projectName: string, date: string): string {
	return [
		"---",
		"id: spec.ux.surface.roadmap",
		"title: Roadmap Surface",
		"state: active",
		`summary: TUI-first roadmap and inferred-delta experience for ${projectName}.`,
		"owners:",
		"- design",
		`updated: '${date}'`,
		"---",
		"",
		"# Roadmap Surface",
		"",
		"## Intent",
		"",
		`Describe how ${projectName} should surface tracked work, inferred work, approvals, and next action inside Pi before users ever inspect raw machine state files.`,
		"",
		"## Related docs",
		"",
		"- [Clients Overview](../overview.md)",
		"- [Status Panel](status-panel.md)",
		"- [System Overview](../../system/overview.md)",
		"",
	].join("\n");
}

function uxStatusPanelDoc(projectName: string, date: string): string {
	return [
		"---",
		"id: spec.ux.surface.status-panel",
		"title: Status Panel",
		"state: active",
		`summary: Compact status-line and panel rules for ${projectName}.`,
		"owners:",
		"- design",
		`updated: '${date}'`,
		"---",
		"",
		"# Status Panel",
		"",
		"## Intent",
		"",
		`Describe how ${projectName} should summarize health, focus, and next action in a panel-first flow while keeping the optional one-line summary short enough to coexist with other Pi extensions.`,
		"",
		"## Related docs",
		"",
		"- [Clients Overview](../overview.md)",
		"- [Roadmap Surface](roadmap.md)",
		"- [System Overview](../../system/overview.md)",
		"",
	].join("\n");
}

function systemSpecDoc(
	projectName: string,
	date: string,
	boundaries: StarterBoundary[],
): string {
	const lines = [
		"---",
		"id: spec.system.overview",
		"title: System Overview",
		"state: active",
		`summary: Main runtime areas and ownership boundaries for ${projectName}.`,
		"owners:",
		"- architecture",
		`updated: '${date}'`,
		"---",
		"",
		"# System Overview",
		"",
		"## Main boundaries",
		"",
		`Map ${projectName} into meaningful ownership areas. Each area should get one canonical overview doc before any deeper split.`,
		"",
		"- product-facing boundary",
		"- runtime or service boundary",
		"- shared or package boundary",
		"",
	];

	if (boundaries.length) {
		lines.push(
			"## Inferred brownfield boundaries",
			"",
			"Setup detected these candidate ownership seams from repo structure. Refine, collapse, or rename them if the codebase uses different stable boundaries.",
			"",
		);
		for (const boundary of boundaries) {
			const target = `.wiki/knowledge/system/${boundary.slug}/overview.md`;
			lines.push(
				`- [${boundary.title}](${posix.relative(".wiki/knowledge/system", target)}) — owns \`${boundary.codePath}\``,
			);
		}
		lines.push("");
	}

	lines.push(
		"## Architecture organization rule",
		"",
		"System docs mirror meaningful project hierarchy, not arbitrary doc categories.",
		"",
		"- one folder per real boundary when needed",
		"- one canonical `overview.md` per boundary",
		"- local decisions live inside owning spec, not in a global ADR bucket",
		"",
		"## Brownfield mapping rule",
		"",
		"For existing repos, setup should infer first-pass ownership specs from repo-relative boundaries before humans refine the language and invariants.",
		"",
		"## Related docs",
		"",
		"- [Product](../product/overview.md)",
		"- [Clients Overview](../clients/overview.md)",
		"",
	);

	return lines.join("\n");
}

function runtimePolicyDoc(projectName: string, date: string): string {
	return [
		"---",
		"id: spec.system.runtime",
		"title: Runtime Policy",
		"state: active",
		`summary: Policy boundary for codewiki runtime access in ${projectName}.`,
		"owners:",
		"- architecture",
		`updated: '${date}'`,
		"---",
		"",
		"# Runtime Policy",
		"",
		"## Responsibility",
		"",
		"The runtime policy keeps agent-facing wiki operations small, inspectable, and bound to the repo-local `.wiki/config.json` contract.",
		"",
		"## Split of responsibility",
		"",
		"- `.wiki/config.json` declares readable paths, direct writable paths, generated read-only paths, byte caps, and runtime adapter metadata.",
		"- `scripts/codewiki-gateway.mjs` is the current adapter for compact reads and validated transaction application.",
		"- A future `think-code` executor may provide generic sandbox isolation while reusing the same policy and transaction schema.",
		"- codewiki owns domain semantics: generated files stay read-only, evidence is append-only, roadmap/task state goes through canonical mutation APIs, and generated state is rebuilt after accepted writes.",
		"",
		"## Transaction v1",
		"",
		"Transactions are JSON objects with `version: 1`, a short `summary`, and an `ops` array. Supported direct ops are exact-text `patch` and `append_jsonl`.",
		"",
		"```json",
		"{",
		'  "version": 1,',
		'  "summary": "Update wiki evidence.",',
		'  "ops": [',
		'    { "kind": "patch", "path": ".wiki/knowledge/system/overview.md", "oldText": "old exact text", "newText": "new exact text" },',
		'    { "kind": "append_jsonl", "path": ".wiki/evidence/runtime.jsonl", "value": { "summary": "Evidence entry" } }',
		"  ]",
		"}",
		"```",
		"",
		"## Related docs",
		"",
		"- [System Overview](../overview.md)",
		"- [Product](../../product/overview.md)",
		"",
	].join("\n");
}

function boundarySpecDoc(
	projectName: string,
	date: string,
	boundary: StarterBoundary,
): string {
	const docPath = `.wiki/knowledge/system/${boundary.slug}/overview.md`;
	const docDir = posix.dirname(docPath);
	const productLink = posix.relative(
		docDir,
		".wiki/knowledge/product/overview.md",
	);
	const uxLink = posix.relative(docDir, ".wiki/knowledge/clients/overview.md");
	const systemLink = posix.relative(
		docDir,
		".wiki/knowledge/system/overview.md",
	);
	const boundaryId = boundary.slug.split("/").join(".");

	return [
		"---",
		`id: spec.${boundaryId}.overview`,
		`title: ${boundary.title}`,
		"state: active",
		`summary: Inferred first-pass ownership boundary for ${boundary.codePath} in ${projectName}.`,
		"owners:",
		"- engineering",
		`updated: '${date}'`,
		"code_paths:",
		`- ${boundary.codePath}`,
		"---",
		"",
		`# ${boundary.title}`,
		"",
		"## Boundary intent",
		"",
		`This overview was inferred during setup from the repo structure at \`${boundary.codePath}\`. Replace the starter language with the real responsibilities, invariants, and collaborators for this boundary.`,
		"",
		"## Refinement prompts",
		"",
		"- describe what this boundary owns",
		"- name the upstream and downstream collaborators",
		"- record invariants that should remain stable even as implementation details change",
		"- collapse or split this spec only when the codebase has a real ownership seam",
		"",
		"## Related docs",
		"",
		`- [Product](${productLink})`,
		`- [Clients Overview](${uxLink})`,
		`- [System Overview](${systemLink})`,
		"",
	].join("\n");
}

function researchJsonl(projectName: string, date: string): string {
	return (
		[
			JSON.stringify({
				id: "RES-001",
				title: `Initial documentation pattern note for ${projectName}`,
				summary:
					"Replace this seed with real external evidence or implementation findings.",
				web_link: "https://example.com",
				source_type: "bootstrap",
				tags: ["seed"],
				created: date,
				updated: date,
			}),
		].join("\n") + "\n"
	);
}

function roadmapJson(projectName: string, date: string): string {
	return (
		JSON.stringify(
			{
				version: 1,
				updated: date,
				order: ["TASK-001", "TASK-002", "TASK-003"],
				tasks: {
					"TASK-001": {
						id: "TASK-001",
						title: "Lock product intent in specs",
						status: "todo",
						priority: "high",
						kind: "docs",
						summary: `Turn ${projectName} intent into explicit product and system docs.`,
						spec_paths: [
							".wiki/knowledge/product/overview.md",
							".wiki/knowledge/system/overview.md",
						],
						code_paths: [],
						research_ids: [],
						labels: ["foundation", "specs"],
						goal: {
							outcome:
								"Project intent and ownership boundaries are explicit enough to guide implementation.",
							acceptance: [
								"Foundational specs describe desired outcomes and major constraints.",
								"At least one roadmap task links back to those specs.",
							],
							non_goals: [
								"Document every implementation detail before the project has real seams.",
							],
							verification: [
								"Review starter specs for project-specific intent and ownership coverage.",
								"Run the rebuild command after replacing placeholders.",
							],
						},
						delta: {
							desired:
								"Product intent and architecture boundaries are explicit and stable.",
							current: "Starter docs need project-specific content.",
							closure:
								"Replace placeholders with concrete intended behavior and ownership boundaries.",
						},
						created: date,
						updated: date,
					},
					"TASK-002": {
						id: "TASK-002",
						title: "Map code ownership into spec hierarchy",
						status: "todo",
						priority: "high",
						kind: "architecture",
						summary:
							"Refine the inferred boundary docs until wiki/system mirrors the repo's real ownership seams without creating doc sprawl.",
						spec_paths: [".wiki/knowledge/system/overview.md"],
						code_paths: [],
						research_ids: [],
						labels: ["brownfield", "mapping"],
						goal: {
							outcome:
								"wiki/system reflects real stable ownership seams in the repo.",
							acceptance: [
								"Each meaningful code area maps to one canonical owning spec.",
								"Unnecessary inferred boundaries are removed or collapsed.",
							],
							non_goals: [
								"Create a spec for every folder regardless of architectural value.",
							],
							verification: [
								"Review inferred boundary docs against actual repo structure.",
								"Run rebuild and inspect mapping/drift output.",
							],
						},
						delta: {
							desired:
								"Each meaningful layer or component has one canonical owning spec.",
							current:
								"Setup can infer first-pass boundaries, but humans still need to confirm or reshape them.",
							closure:
								"Add, remove, or rewrite inferred spec folders until they match real stable ownership seams.",
						},
						created: date,
						updated: date,
					},
					"TASK-003": {
						id: "TASK-003",
						title: "Keep roadmap as freshest delta log",
						status: "todo",
						priority: "medium",
						kind: "process",
						summary:
							"Move drift and plan tracking into structured roadmap tasks instead of separate prose buckets.",
						spec_paths: [".wiki/knowledge/clients/overview.md"],
						code_paths: [],
						research_ids: [],
						labels: ["roadmap", "process"],
						goal: {
							outcome:
								"Tracked delta lives in roadmap tasks instead of scattered prose.",
							acceptance: [
								"Active implementation gaps are represented by roadmap tasks.",
								"Users can resume task work from Pi surfaces without editing roadmap JSON manually.",
							],
							non_goals: [
								"Maintain separate plan and drift documents for the same live work.",
							],
							verification: [
								"Inspect generated roadmap view after rebuild.",
								"Confirm roadmap tasks cover current active delta.",
							],
						},
						delta: {
							desired:
								"Roadmap is single current queue for closing docs-to-code gaps.",
							current:
								"Teams often spread gaps across plans, drift notes, and chat.",
							closure:
								"Convert each active mismatch or sequence into a scoped roadmap task.",
						},
						created: date,
						updated: date,
					},
				},
			},
			null,
			2,
		) + "\n"
	);
}

function rebuildScript(): string {
	const templateDir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(
		join(templateDir, "..", "..", "scripts", "rebuild_docs_meta.py"),
		"utf8",
	);
}
