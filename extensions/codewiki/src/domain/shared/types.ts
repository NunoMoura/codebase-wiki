/**
 * domain/shared/types.ts
 *
 * All shared domain types. No agent-specific dependencies.
 * Adapters (Pi, MCP, CLI, etc.) must NOT appear here.
 */

export const ROADMAP_STATUS_VALUES = [
	"todo",
	"research",
	"implement",
	"verify",
	"done",
	"cancelled",
	"in_progress",
	"blocked",
] as const;
export const TASK_PHASE_VALUES = ["research", "implement", "verify", "done"] as const;
export const ROADMAP_PRIORITY_VALUES = [
	"critical",
	"high",
	"medium",
	"low",
] as const;
export const TASK_SESSION_ACTION_VALUES = [
	"focus",
	"progress",
	"blocked",
	"done",
	"spawn",
	"note",
	"clear",
] as const;
export const TOOL_TASK_STATUS_VALUES = [
	"todo",
	"in_progress",
	"blocked",
	"done",
	"cancelled",
] as const;
export const TASK_EVIDENCE_RESULT_VALUES = [
	"progress",
	"pass",
	"fail",
	"block",
	"done_candidate",
] as const;

export const SUBAGENT_ROLE_VALUES = ["implementer", "auditor", "architect"] as const;
export const SUBAGENT_VERDICT_VALUES = ["pass", "fail", "block"] as const;
export const SUBAGENT_PROPOSAL_VALUES = ["task", "refactor", "spec"] as const;
export const CODEWIKI_STATE_SECTION_VALUES = ["repo", "health", "summary", "roadmap", "graph", "drift", "session", "task"] as const;
export const HEARTBEAT_MODE_VALUES = ["auto", "dry-run", "manual", "observe", "maintain"] as const;
export const HEARTBEAT_RISK_VALUES = ["low", "medium", "high"] as const;
export const STATUS_DOCK_DENSITY_VALUES = ["minimal", "standard", "full"] as const;
export const STATUS_DOCK_MODE_VALUES = ["auto", "pin", "off"] as const;
export const STATUS_SCOPE_VALUES = ["repo", "task", "spec", "both", "docs", "code"] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUS_VALUES)[number];
export type TaskPhase = (typeof TASK_PHASE_VALUES)[number];
export type RoadmapPriority = (typeof ROADMAP_PRIORITY_VALUES)[number];
export type TaskSessionAction = (typeof TASK_SESSION_ACTION_VALUES)[number];
export type ToolTaskStatus = (typeof TOOL_TASK_STATUS_VALUES)[number];
export type TaskEvidenceResult = (typeof TASK_EVIDENCE_RESULT_VALUES)[number];
export type SubagentRole = (typeof SUBAGENT_ROLE_VALUES)[number];
export type SubagentVerdict = (typeof SUBAGENT_VERDICT_VALUES)[number];
export type TaskVerifierVerdict = SubagentVerdict;
export type SubagentProposalKind = (typeof SUBAGENT_PROPOSAL_VALUES)[number];
export type CodewikiStateSection = (typeof CODEWIKI_STATE_SECTION_VALUES)[number];
export type HeartbeatMode = (typeof HEARTBEAT_MODE_VALUES)[number];
export type HeartbeatRisk = (typeof HEARTBEAT_RISK_VALUES)[number];
export type StatusDockDensity = (typeof STATUS_DOCK_DENSITY_VALUES)[number];
export type StatusDockMode = (typeof STATUS_DOCK_MODE_VALUES)[number];
export type StatusScope = (typeof STATUS_SCOPE_VALUES)[number];

export interface RoadmapTaskInput {
	id?: string;
	title: string;
	status?: RoadmapStatus;
	priority?: RoadmapPriority;
	kind?: string;
	summary?: string;
	spec_paths?: string[];
	code_paths?: string[];
	research_ids?: string[];
	labels?: string[];
	goal?: Partial<RoadmapTaskGoal>;
	delta?: Partial<{ desired: string; current: string; closure: string }>;
}

export interface RoadmapTaskUpdateInput {
	taskId: string;
	title?: string;
	status?: RoadmapStatus;
	priority?: RoadmapPriority;
	kind?: string;
	summary?: string;
	spec_paths?: string[];
	code_paths?: string[];
	research_ids?: string[];
	labels?: string[];
	goal?: Partial<RoadmapTaskGoal>;
	delta?: Partial<{ desired: string; current: string; closure: string }>;
}

export interface RoadmapTaskUpdateFields {
	title?: string;
	priority?: RoadmapPriority;
	kind?: string;
	summary?: string;
	status?: RoadmapStatus;
	spec_paths?: string[];
	code_paths?: string[];
	research_ids?: string[];
	labels?: string[];
	goal?: Partial<RoadmapTaskGoal>;
	delta?: Partial<{ desired: string; current: string; closure: string }>;
}

export interface RoadmapTaskGoal {
	outcome: string;
	acceptance: string[];
	non_goals: string[];
	verification: string[];
}

export interface RoadmapTaskRecord {
	id: string;
	title: string;
	status: RoadmapStatus;
	priority: RoadmapPriority;
	kind: string;
	summary: string;
	spec_paths: string[];
	code_paths: string[];
	research_ids: string[];
	labels: string[];
	goal: RoadmapTaskGoal;
	delta: {
		desired: string;
		current: string;
		closure: string;
	};
	created: string;
	updated: string;
}

export interface RoadmapFile {
	version: number;
	updated: string;
	order: string[];
	tasks: Record<string, RoadmapTaskRecord>;
}

export interface WikiProject {
	root: string;
	label: string;
	config: DocsConfig;
	docsRoot: string;
	specsRoot: string;
	evidenceRoot: string;
	researchRoot: string;
	indexPath: string;
	roadmapPath: string;
	roadmapDocPath: string;
	roadmapEventsPath: string;
	metaRoot: string;
	viewsRoot: string;
	graphPath: string;
	lintPath: string;
	roadmapStatePath: string;
	statusStatePath: string;
	eventsPath: string;
	configPath: string;
}

export interface DocsConfig {
	project_name?: string;
	wiki_root?: string;
	docs_root?: string;
	specs_root?: string;
	evidence_root?: string;
	research_root?: string;
	index_path?: string;
	roadmap_path?: string;
	roadmap_doc_path?: string;
	roadmap_events_path?: string;
	meta_root?: string;
	views_root?: string;
	roadmap_retention?: {
		compress_archive?: boolean;
		archive_path?: string;
		closed_task_limit?: number;
	};
	codewiki?: {
		rebuild_command?: string | string[];
		self_drift_scope?: ScopeConfig;
		code_drift_scope?: CodeDriftScopeConfig;
	};
}

export interface RoadmapStateTaskSummary {
	id: string;
	title: string;
	status: RoadmapStatus;
	priority: string;
	summary: string;
	updated: string;
	spec_paths?: string[];
	code_paths?: string[];
	labels?: string[];
	goal?: RoadmapTaskGoal;
	context_path?: string;
	loop?: {
		phase: TaskPhase;
		updated_at: string;
		evidence?: {
			verdict: string;
			summary: string;
			checks_run?: string[];
			files_touched?: string[];
			issues?: string[];
			updated_at?: string;
		};
	};
}

export interface RoadmapStateFile {
	version: number;
	generated_at: string;
	health: RoadmapStateHealth;
	summary: {
		task_count: number;
		open_count: number;
		status_counts: Record<string, number>;
		priority_counts: Record<string, number>;
	};
	views: {
		ordered_task_ids: string[];
		open_task_ids: string[];
		in_progress_task_ids: string[];
		todo_task_ids: string[];
		blocked_task_ids: string[];
		done_task_ids: string[];
		cancelled_task_ids: string[];
		recent_task_ids: string[];
	};
	tasks: Record<string, RoadmapStateTaskSummary>;
	source?: {
		task_context_root: string;
	};
}

export interface TaskSessionLinkRecord {
	taskId: string;
	action: TaskSessionAction;
	summary: string;
	filesTouched: string[];
	spawnedTaskIds: string[];
	timestamp: string;
}

export interface TaskSessionLinkInput {
	taskId: string;
	action?: string;
	summary?: string;
	filesTouched?: string[];
	spawnedTaskIds?: string[];
	setSessionName?: boolean;
}

export interface TaskLoopUpdateInput {
	taskId: string;
	action: "pass" | "fail" | "block";
	phase?: string;
	summary: string;
	checks_run?: string[];
	files_touched?: string[];
	issues?: string[];
}

export interface CodewikiTaskEvidenceInput {
	summary: string;
	result?: TaskEvidenceResult;
	checks_run?: string[];
	files_touched?: string[];
	issues?: string[];
}

export interface HeartbeatBudget {
	maxCycles?: number;
	maxWallSeconds?: number;
	maxWrites?: number;
	maxSubagents?: number;
	risk?: HeartbeatRisk;
}

export interface CodewikiHeartbeatToolInput {
	repoPath?: string;
	mode?: HeartbeatMode;
	budget?: HeartbeatBudget;
	dryRun?: boolean;
}

export type HeartbeatToolInput = CodewikiHeartbeatToolInput;

export interface CodewikiTaskPatchInput {
	title?: string;
	priority?: RoadmapPriority;
	kind?: string;
	summary?: string;
	status?: ToolTaskStatus;
	phase?: TaskPhase | null;
	spec_paths?: string[];
	code_paths?: string[];
	research_ids?: string[];
	labels?: string[];
	goal?: Partial<RoadmapTaskGoal>;
	delta?: Partial<{ desired: string; current: string; closure: string }>;
}

export interface CodewikiTaskToolInput {
	repoPath?: string;
	action: "create" | "update" | "close" | "cancel" | "checkpoint" | "clear-archive";
	tasks?: RoadmapTaskInput[];
	taskId?: string;
	summary?: string;
	patch?: CodewikiTaskPatchInput;
	evidence?: CodewikiTaskEvidenceInput;
	refresh?: boolean;
}

export interface CodewikiSessionToolInput {
	repoPath?: string;
	action: "focus" | "note" | "clear";
	taskId?: string;
	summary?: string;
	files_touched?: string[];
	setSessionName?: boolean;
	refresh?: boolean;
}

export interface CodewikiStateToolInput {
	repoPath?: string;
	refresh?: boolean;
	include?: CodewikiStateSection[];
	taskId?: string;
}

export interface TaskVerifierResult {
	verdict: "pass" | "fail" | "block";
	taskId: string;
	checks: string[];
	issues: TaskVerifierIssue[];
	rationale: string;
}

export interface TaskVerifierIssue {
	severity: "high" | "medium" | "low";
	summary: string;
	evidence?: string;
}

export interface LintIssue {
	severity: "error" | "warning" | string;
	kind: string;
	path: string;
	line?: number;
	column?: number;
	message: string;
	code?: string;
}

export interface LintReport {
	generated_at: string;
	issues: LintIssue[];
	counts: Record<string, number>;
}

export interface StatusStateFile {
	version: number;
	generated_at: string;
	project: {
		name: string;
		docs_root: string;
		roadmap_path: string;
	};
	health: {
		color: "green" | "yellow" | "red";
		errors: number;
		warnings: number;
		total_issues: number;
	};
	summary: {
		total_specs: number;
		mapped_specs: number;
		aligned_specs: number;
		tracked_specs: number;
		untracked_specs: number;
		blocked_specs: number;
		unmapped_specs: number;
		task_count: number;
		open_task_count: number;
		done_task_count: number;
	};
	bars: {
		tracked_drift: StatusStateBar;
		roadmap_done: StatusStateBar;
		spec_mapping: StatusStateBar;
	};
	views: {
		risky_spec_paths: string[];
		top_risky_spec_paths: string[];
		open_task_ids: string[];
	};
	next_step: {
		kind: string;
		command: string;
		reason: string;
	};
	direction: string[];
	specs: StatusStateSpecRow[];
	heartbeat: {
		generated_at: string;
		summary: {
			lane_count: number;
			freshness_basis: string;
			high_cadence_lane_ids: string[];
			medium_cadence_lane_ids: string[];
			low_cadence_lane_ids: string[];
		};
		lanes: StatusStateHeartbeatLane[];
	};
	resume: {
		source: "task" | "heartbeat" | "next_step";
		task_id: string;
		lane_id: string;
		heading: string;
		command: string;
		reason: string;
		phase: string;
		verification: string;
		evidence: string;
		heartbeat: string;
	};
	parallel: {
		generated_at: string;
		active_session_count: number;
		collision_task_ids: string[];
		sessions: StatusStateParallelSession[];
	};
	wiki: {
		rows: StatusStateSpecRow[];
		sections: StatusStateWikiSection[];
	};
	roadmap: {
		focused_task_id: string;
		blocked_task_ids: string[];
		in_progress_task_ids: string[];
		next_task_id: string;
		columns: StatusStateRoadmapColumn[];
	};
	agents: {
		rows: StatusStateAgentRow[];
	};
	channels: {
		add_label: string;
		rows: StatusStateChannelRow[];
	};
}

export interface GraphNode {
	id: string;
	kind: string;
	title?: string;
	path?: string;
	[key: string]: any;
}

export interface GraphEdge {
	from: string;
	to: string;
	kind: string;
	[key: string]: any;
}

export interface GraphViews {
	roadmap?: {
		task_ids?: string[];
		open_task_ids?: string[];
		[key: string]: any;
	};
	[key: string]: any;
}

export interface GraphFile {
	version: number;
	generated_at: string;
	nodes: GraphNode[];
	edges: GraphEdge[];
	views?: GraphViews;
}

export interface RoadmapTaskContextPacket {
	version: number;
	generated_at: string;
	context_path: string;
	task: any;
	budget?: any;
	revision?: any;
	code?: any;
	specs?: any;
	evidence?: any;
}

export interface StatusStateSpecRow {
	path: string;
	title: string;
	summary: string;
	drift_status: "aligned" | "tracked" | "untracked" | "blocked" | "unmapped";
	code_paths: string[];
	code_area: string;
	issue_counts: { errors: number; warnings: number; total: number };
	related_task_ids: string[];
	primary_task: { id: string; status: string; title: string } | null;
	revision: any;
	note: string;
}

export interface StatusStateBar {
	label: string;
	value: number;
	total: number;
	percent: number;
}

export interface StatusStateHeartbeatLane {
	id: string;
	title: string;
	cadence: string;
	freshness_basis: string;
	fallback_max_age_hours: number;
	interval_hours: number;
	triggers: string[];
	checked_at: string;
	revision: any;
	freshness: {
		status: "fresh" | "stale";
		basis: string;
		checked_at: string;
		reason: string;
		stale_state_guidance: string;
	};
	spec_paths: string[];
	code_paths: string[];
	code_area: string;
	open_task_ids: string[];
	risky_spec_paths: string[];
	stats: {
		total_specs: number;
		aligned_specs: number;
		tracked_specs: number;
		untracked_specs: number;
		blocked_specs: number;
		unmapped_specs: number;
	};
	recommendation: {
		kind: string;
		command: string;
		reason: string;
	};
}

export interface StatusStateParallelSession {
	session_id: string;
	task_id: string;
	action: string;
	timestamp: string;
	title: string;
	summary: string;
	agent_name: string;
}

export interface StatusStateAgentRow {
	id: string;
	label: string;
	name: string;
	task_id: string;
	task_title: string;
	mode: string;
	status: string;
	last_action: string;
	constraint: string;
	session_id: string;
}

export interface StatusStateChannelRow {
	id: string;
	label: string;
	kind: string;
	target: string;
	description: string;
	status: string;
	scope: string;
	last_delivery_at: string;
	error?: string;
}

export interface StatusStateWikiSection {
	id: string;
	label: string;
	rows: StatusStateSpecRow[];
}

export interface StatusStateRoadmapColumn {
	id: string;
	label: string;
	task_ids: string[];
}

export interface StatusDockPrefs {
	version: number;
	density: StatusDockDensity;
	mode: StatusDockMode;
	lastRepoPath?: string;
	pinnedRepoPath?: string;
}

export type StatusPanelSection = any;

export interface StatusPanelDetail {
	sections?: any[];
	actions?: any[];
	kind?: string;
	selectedActionIndex?: number;
	title?: string;
	lines?: string[];
	[key: string]: any;
}

export interface ActiveStatusPanel {
	project: ResolvedStatusDockProject;
	density: StatusDockDensity;
	section: any;
	source: string;
	scope: StatusScope;
	requestRender?: () => void;
	close?: () => void;
	detail: StatusPanelDetail | null;
	activeLink: TaskSessionLinkRecord | null;
	sessionId: string;
	homeIssueIndex: number;
	wikiRowIndex: number;
	wikiColumnIndex: number;
	animationTick: number;
	roadmapColumnIndex: number;
	roadmapRowIndex: number;
	agentRowIndex: number;
	channelRowIndex: number;
	animationTimer?: any;
}

export interface ActiveConfigPanel {
	requestRender?: () => void;
	close?: () => void;
	section: any;
	pinActionIndex: number;
}

export interface ArchitecturePanelComponent {
	id: string;
	label: string;
	path: string;
	summary: string;
}

export interface CodeDriftScopeConfig {
	include: string[];
	exclude?: string[];
	docs?: string[];
	repo_docs?: string[];
	code?: string[];
}

export type ConfigPanelSection = any;

export interface DriftContext {
	selfInclude: string[];
	selfExclude: string[];
	docsScope: string[];
	docsExclude: string[];
	repoDocs: string[];
	codeScope: string[];
}

export interface HomeIssue {
	severity: "blocker" | "warning" | "info";
	title: string;
	impact: string;
	recommended: string;
	detail: string[];
}

export interface ResolvedStatusDockProject extends WikiProject {
	project: WikiProject;
	source: string;
	statusState?: StatusStateFile;
}

export interface RoadmapStateHealth {
	color: "green" | "yellow" | "red";
	errors: number;
	warnings: number;
	total_issues: number;
}

export interface ScopeConfig {
	include: string[];
	exclude?: string[];
}
