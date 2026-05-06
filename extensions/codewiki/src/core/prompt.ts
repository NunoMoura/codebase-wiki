import { resolve, basename } from "node:path";
import { unique } from "./utils";
import type { 
    WikiProject, 
    GraphFile, 
    LintReport, 
    RoadmapTaskRecord, 
    RoadmapTaskContextPacket,
    StatusScope,
    RoadmapStatus,
    RoadmapStateTaskSummary
} from "./types";
import { 
    taskBoardColumn, 
    isTaskBlocked, 
    taskLoopPhase, 
    taskLoopEvidenceLine 
} from "./roadmap";

export function statusColor(report: LintReport): "green" | "yellow" | "red" {
	if (report.counts.error > 0) return "red";
	if (report.counts.warning > 0) return "yellow";
	return "green";
}

export interface DriftContext {
	selfInclude: string[];
	selfExclude: string[];
	docsScope: string[];
	docsExclude: string[];
	repoDocs: string[];
	codeScope: string[];
}

export const TASK_PHASE_DRIVERS: Record<
	"research" | "implement" | "verify",
	{ label: string; guidance: string }
> = {
	research: {
		label: "Research",
		guidance: "gather new evidence and align specs before implementation",
	},
	implement: {
		label: "Implement",
		guidance: "change code and wiki artifacts surgically to match specs",
	},
	verify: {
		label: "Verify",
		guidance:
			"validate fresh-context alignment of intent, knowledge, and code",
	},
};

export function defaultSelfDriftScope(project: WikiProject) {
	return {
		include: [".wiki/knowledge/product/**/*.md", ".wiki/knowledge/system/**/*.md"],
		exclude: [
			".wiki/knowledge/system/architecture/mermaid.md",
			".wiki/knowledge/system/architecture/components.json",
		],
	};
}

export function defaultCodeDriftDocsScope(project: WikiProject) {
	return [".wiki/knowledge/product/**/*.md", ".wiki/knowledge/system/**/*.md"];
}

export function buildDriftContext(
	project: WikiProject,
	graph: GraphFile | null,
): DriftContext {
	const selfScope =
		project.config.codewiki?.self_drift_scope ?? defaultSelfDriftScope(project);
	const selfInclude = unique(selfScope.include ?? []);
	const selfExclude = unique(selfScope.exclude ?? []);
	const docsScope = unique(
		project.config.codewiki?.code_drift_scope?.docs ??
			defaultCodeDriftDocsScope(project),
	);
	const docsExclude = unique(
		project.config.codewiki?.self_drift_scope?.exclude ??
			defaultSelfDriftScope(project).exclude ??
			[],
	);
	const repoDocs = unique(
		project.config.codewiki?.code_drift_scope?.repo_docs ?? ["README.md"],
	);
	const configCode = unique(
		project.config.codewiki?.code_drift_scope?.code ?? [],
	);
	const graphCode = unique(graph?.views?.code?.paths ?? []);
	const codeScope = unique([...configCode, ...graphCode]);
	return {
		selfInclude,
		selfExclude,
		docsScope,
		docsExclude,
		repoDocs,
		codeScope,
	};
}

export function promptContextFiles(project: WikiProject): string[] {
	return unique([
		"README.md",
		".wiki/config.json",
		project.roadmapStatePath,
		project.statusStatePath,
	]);
}

export function graphSpecCodePaths(
	graph: GraphFile | null,
	specPath: string,
): string[] {
	if (!graph) return [];
	const docNodeId = `doc:${specPath}`;
	return unique(
		(graph.edges ?? [])
			.filter(
				(edge) => edge.kind === "doc_code_path" && edge.from === docNodeId,
			)
			.map((edge) => edge.to.replace(/^code:/, "")),
	);
}

export function renderSpecPromptMap(graph: GraphFile | null): string[] {
	const graphSpecs = (graph?.nodes ?? [])
		.filter(
			(node) => node.kind === "doc" && node.doc_type === "spec" && node.path,
		)
		.map((node) => ({
			path: node.path as string,
			title: node.title,
			code_paths: graphSpecCodePaths(graph, node.path as string),
		}))
		.sort((a, b) => a.path.localeCompare(b.path));
	if (graphSpecs.length === 0) return ["- none"];
	return graphSpecs.map((spec) => {
		const codePaths = unique(spec.code_paths ?? []);
		return `- ${spec.title ?? spec.path} | ${spec.path} | code=${codePaths.length > 0 ? codePaths.join(", ") : "none mapped"}`;
	});
}

export function renderScope(label: string, items: string[]): string[] {
	return items.length > 0 ? [`${label}:`, ...items.map((i) => `- ${i}`)] : [];
}

export function renderList(items: string[]): string[] {
	return items.length > 0 ? items.map((i) => `- ${i}`) : ["- none"];
}

export function renderScopeForPrompt(
	scope: StatusScope | "both",
	drift: DriftContext,
): string[] {
	if (scope === "docs") {
		return [
			"Docs drift scope:",
			...renderScope("Include", drift.selfInclude),
			...renderScope("Exclude", drift.selfExclude),
		];
	}
	if (scope === "code") {
		return [
			"Docs scope:",
			...renderScope("Include", drift.docsScope),
			...renderScope("Exclude", drift.docsExclude),
			"Additional repository docs:",
			...renderList(drift.repoDocs),
			"Implementation scope:",
			...renderList(
				drift.codeScope.length > 0
					? drift.codeScope
					: [
							"Use code paths referenced by live specs; no explicit code scope configured.",
						],
			),
		];
	}
	return [
		"Docs drift scope:",
		...renderScope("Include", drift.selfInclude),
		...renderScope("Exclude", drift.selfExclude),
		"Code comparison scope:",
		...renderScope("Docs include", drift.docsScope),
		...renderScope("Docs exclude", drift.docsExclude),
		"Additional repository docs:",
		...renderList(drift.repoDocs),
		"Implementation scope:",
		...renderList(
			drift.codeScope.length > 0
				? drift.codeScope
				: [
						"Use code paths referenced by live specs; no explicit code scope configured.",
					],
		),
	];
}

export function compactDigest(value: unknown): string {
	const text = typeof value === "string" ? value : "";
	return text ? text.slice(0, 12) : "—";
}

export function contextRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export function contextStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.map((item) => String(item).trim()).filter(Boolean)
		: [];
}

export function renderTaskContextForPrompt(
	packet: RoadmapTaskContextPacket | null,
): string[] {
	if (!packet) return [];
	const budget = contextRecord(packet.budget);
	const revision = contextRecord(packet.revision);
	const taskRevision = contextRecord(revision.task);
	const gitRevision = contextRecord(revision.git);
	const code = contextRecord(packet.code);
	const codePaths = contextStringList(code.paths);
	const specs = Array.isArray(packet.specs) ? packet.specs : [];
	const evidence = contextRecord(packet.evidence);
	return [
		"Compact task context packet:",
		`- Path: ${packet.context_path}`,
		`- Budget: ${budget.target_tokens ?? 6000} tokens; ${budget.policy ?? "Use packet first; expand listed files only when needed."}`,
		`- Revision: task=${compactDigest(taskRevision.digest)} spec=${compactDigest(revision.spec_digest)} code=${compactDigest(revision.code_digest)} git=${compactDigest(gitRevision.head)} dirty=${gitRevision.dirty === true ? "yes" : "no"}`,
		...(specs.length > 0
			? [
					"Spec contracts:",
					...specs.slice(0, 8).map((item) => {
						const spec = contextRecord(item);
						const specRevision = contextRecord(spec.revision);
						return `- ${spec.path ?? "unknown"} | ${spec.title ?? "Untitled"} | ${spec.summary ?? ""} | digest=${compactDigest(specRevision.digest)}`;
					}),
				]
			: []),
		...(codePaths.length > 0
			? [
					"Code expansion paths:",
					...codePaths.slice(0, 12).map((path) => `- ${path}`),
				]
			: []),
		...(evidence.summary
			? [
					"Latest evidence:",
					`- ${evidence.verdict ?? "progress"}: ${evidence.summary}`,
				]
			: []),
		"Expansion rule: read only listed specs/code/evidence when packet is insufficient, stale, or exact implementation detail is required.",
	];
}

export function codePrompt(
	project: WikiProject,
	graph: GraphFile | null,
	report: LintReport,
	task: RoadmapTaskRecord,
	phase = "implement",
	evidence = "No closure evidence recorded yet.",
	taskContext: RoadmapTaskContextPacket | null = null,
): string {
	const drift = buildDriftContext(project, graph);
	const taskContextLines = renderTaskContextForPrompt(taskContext);
	const fallbackContextLines = [
		...renderScopeForPrompt("both", drift),
		"Context files:",
		...promptContextFiles(project),
		"Spec map:",
		...renderSpecPromptMap(graph),
	];
	return [
		`Implement roadmap task ${task.id} for ${project.label}.`,
		`Task title: ${task.title}.`,
		`Task status: ${task.status}.`,
		`Task priority: ${task.priority}.`,
		`Task kind: ${task.kind}.`,
		`Task summary: ${task.summary}.`,
		`Deterministic task phase: ${phase}.`,
		`Latest evidence summary: ${evidence}.`,
		...(task.goal.outcome ? [`Task outcome: ${task.goal.outcome}.`] : []),
		...(task.goal.acceptance.length > 0
			? [
					"Task success signals:",
					...task.goal.acceptance.map((item) => `- ${item}`),
				]
			: []),
		...(task.goal.non_goals.length > 0
			? ["Task non-goals:", ...task.goal.non_goals.map((item) => `- ${item}`)]
			: []),
		...(task.goal.verification.length > 0
			? [
					"Task verification steps:",
					...task.goal.verification.map((item) => `- ${item}`),
				]
			: []),
		`Deterministic preflight color: ${statusColor(report)}.`,
		...(taskContextLines.length > 0 ? taskContextLines : fallbackContextLines),
		"Task delta:",
		`- Desired: ${task.delta.desired}`,
		`- Current: ${task.delta.current}`,
		`- Closure: ${task.delta.closure}`,
		...(task.spec_paths.length > 0
			? ["Task spec paths:", ...task.spec_paths.map((path) => `- ${path}`)]
			: []),
		...(task.code_paths.length > 0
			? ["Task code paths:", ...task.code_paths.map((path) => `- ${path}`)]
			: []),
		...(task.research_ids.length > 0
			? [
					"Task research ids:",
					...task.research_ids.map((researchId) => `- ${researchId}`),
				]
			: []),
		"Rules:",
		`- follow the deterministic task phase: ${TASK_PHASE_DRIVERS.implement.guidance} ${TASK_PHASE_DRIVERS.verify.guidance}`,
		"- treat parent context as expensive RAM: keep focused task, loaded view revisions, and small decisions; do not load raw wiki trees by default",
		"- consume status/task views first, expand linked canonical docs/code only when the view points there or exact source is required",
		"- use subagents for fresh verification/research/architecture review and available bounded context tools for programmatic context packets; ThinkCode is optional and governed by its own skill",
		"- if current phase is implement, build context through the gateway or compact task packet first, then change code or wiki surgically against specs and roadmap truth",
		"- during implement, use lint, typecheck, tests, runtime feedback, and Pi-lens as short-cycle correction signals for mechanical code quality",
		"- if current phase is verify, use fresh-context alignment validation: check user intent, knowledge, architecture, code, evidence, and intra-layer coherence before recommending done",
		"- codewiki verify should judge alignment/coherence; do not reduce it to linting or typechecking",
		"- gather research only when uncertainty or unsupported claims require new evidence",
		"- implement according to specs and roadmap; surface drift instead of silently choosing code over wiki",
		"- keep public UX focused on wiki-bootstrap, wiki-status, wiki-config, and wiki-resume, while Alt+W toggles the live status panel",
		"- do not create a separate user-facing wiki-edit command; update roadmap/wiki artifacts automatically when user intent requires it",
		"- if intended design must change, update wiki docs and code consistently",
		"- if this task finishes, blocks, or needs evidence recorded, use codewiki_task to persist canonical task truth",
		"- if follow-up delta appears that is not already tracked, use codewiki_task action=create",
		"- rebuild generated outputs before finishing",
		"- rerun deterministic status before summarizing",
		"Output format:",
		"- Changes made",
		"- Task status recommendation: todo|implement|verify|done|blocked",
		"- Wiki updates made automatically, if any",
		"- Remaining risks or follow-ups",
	].join("\n");
}
