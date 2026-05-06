import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	GraphFile,
	LintReport,
	RoadmapStateFile,
	RoadmapTaskRecord,
	StatusStateFile,
	StatusStateHeartbeatLane,
	StatusStateSpecRow,
	WikiProject,
} from "../core/types";
import { ParsedDoc } from "./parser";
import { nowIso } from "../core/utils";

export function sha256Text(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

export function canonicalDigest(value: any): string {
	// Simple stable JSON stringify for basic objects
	const stableStringify = (obj: any): any => {
		if (obj === null || typeof obj !== "object") return obj;
		if (Array.isArray(obj)) return obj.map(stableStringify);
		return Object.keys(obj)
			.sort()
			.reduce((result: any, key) => {
				result[key] = stableStringify(obj[key]);
				return result;
			}, {});
	};
	return sha256Text(JSON.stringify(stableStringify(value)));
}

export function normalizeTaskPhase(value: any): string {
	const phase = String(value || "").trim();
	if (phase === "research") return "implement";
	return ["implement", "verify", "done"].includes(phase) ? phase : "implement";
}

export function nextTaskPhase(phase: string): string {
	if (phase === "implement") return "verify";
	return "done";
}

export function defaultTaskPhase(status: string): string {
	const normalized = String(status || "todo").trim();
	if (normalized === "research") return "implement";
	if (["implement", "verify", "done"].includes(normalized)) return normalized;
	return "implement";
}

export function roadmapTaskStage(status: any, loopPhase: any = ""): string {
	const normalized = String(status || "todo").trim();
	if (normalized === "research") return "research";
	if (["todo", "implement", "verify", "done"].includes(normalized)) return normalized;
	if (["in_progress", "blocked"].includes(normalized)) return normalizeTaskPhase(loopPhase);
	return "todo";
}

export function isOpenTaskStatus(status: any): boolean {
	return ["todo", "research", "implement", "verify", "in_progress", "blocked"].includes(String(status || "").trim());
}

export function isActiveTaskStatus(status: any): boolean {
	return ["research", "implement", "verify", "in_progress", "blocked"].includes(String(status || "").trim());
}

export function buildTaskLoopState(taskId: string, status: string, events: any[]) {
	let phase = defaultTaskPhase(status);
	let updatedAt = "";
	let evidence: any = null;

	for (const event of events) {
		if (String(event.task_id || event.taskId || "").trim() !== taskId) continue;
		const kind = String(event.kind || "").trim();
		const timestamp = String(event.ts || "").trim();

		if (kind === "task_phase_started") {
			phase = normalizeTaskPhase(event.phase);
			updatedAt = timestamp || updatedAt;
		} else if (kind === "task_phase_passed") {
			phase = nextTaskPhase(normalizeTaskPhase(event.phase));
			updatedAt = timestamp || updatedAt;
		} else if (kind === "task_phase_failed") {
			phase = "implement";
			updatedAt = timestamp || updatedAt;
		} else if (kind === "task_phase_blocked") {
			phase = normalizeTaskPhase(event.phase);
			updatedAt = timestamp || updatedAt;
		} else if (kind === "task_evidence_recorded") {
			evidence = {
				verdict: String(event.verdict || "pass").trim() || "pass",
				summary: String(event.summary || "").trim(),
				checks_run: Array.isArray(event.checks_run) ? event.checks_run : [],
				files_touched: Array.isArray(event.files_touched) ? event.files_touched : [],
				issues: Array.isArray(event.issues) ? event.issues : [],
				updated_at: timestamp,
			};
			updatedAt = timestamp || updatedAt;
		}
	}

	return { phase, updated_at: updatedAt, evidence };
}

export function lintHealth(lintReport: LintReport) {
	const issues = Array.isArray(lintReport.issues) ? lintReport.issues : [];
	const errors = issues.filter((i: any) => String(i.severity) === "error").length;
	const warnings = issues.filter((i: any) => String(i.severity) === "warning").length;
	const color = errors > 0 ? "red" : warnings > 0 ? "yellow" : "green";

	return {
		color,
		errors,
		warnings,
		total_issues: issues.length,
	};
}

export function buildRoadmapState(
	project: WikiProject,
	entries: RoadmapTaskRecord[],
	graph: GraphFile,
	lintReport: LintReport,
	events: any[] = []
): RoadmapStateFile {
	const graphViews = graph.views || {};
	const graphRoadmap = graphViews.roadmap || {};
	const ordered = entries.map((item) => String(item.id || "").trim()).filter(Boolean);

	const statusCounts: Record<string, number> = {};
	const priorityCounts: Record<string, number> = {};
	const tasks: Record<string, any> = {};

	for (const item of entries) {
		const status = String(item.status || "todo");
		const priority = String(item.priority || "medium");
		statusCounts[status] = (statusCounts[status] || 0) + 1;
		priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

		const taskId = String(item.id || "").trim();
		if (!taskId) continue;

		const goal = item.goal || ({} as any);
		tasks[taskId] = {
			id: taskId,
			title: String(item.title || taskId).trim(),
			status,
			priority,
			kind: String(item.kind || "task").trim(),
			summary: String(item.summary || "").trim(),
			labels: Array.isArray(item.labels) ? item.labels : [],
			goal: {
				outcome: String(goal.outcome || "").trim(),
				acceptance: Array.isArray(goal.acceptance) ? goal.acceptance : [],
				non_goals: Array.isArray(goal.non_goals) ? goal.non_goals : [],
				verification: Array.isArray(goal.verification) ? goal.verification : [],
			},
			spec_paths: Array.isArray(item.spec_paths) ? item.spec_paths : [],
			code_paths: Array.isArray(item.code_paths) ? item.code_paths : [],
			updated: String(item.updated || "").trim(),
			context_path: `.wiki/roadmap/tasks/${taskId}/context.json`,
			loop: buildTaskLoopState(taskId, status, events),
		};
	}

	const sortedEntries = [...entries].sort((a, b) => {
		const statusOrder: Record<string, number> = {
			in_progress: 1,
			blocked: 2,
			todo: 3,
			research: 4,
			implement: 5,
			verify: 6,
			done: 7,
			cancelled: 8,
		};
		const p1 = statusOrder[String(a.status || "todo")] || 99;
		const p2 = statusOrder[String(b.status || "todo")] || 99;
		if (p1 !== p2) return p1 - p2;
		return String(a.id || "").localeCompare(String(b.id || ""));
	});

	const recentEntries = [...entries].sort((a, b) => {
		const d1 = String(a.updated || "");
		const d2 = String(b.updated || "");
		if (d1 !== d2) return d2.localeCompare(d1);
		return String(b.id || "").localeCompare(String(a.id || ""));
	});

	const blockedTaskIds = sortedEntries
		.filter((t) => {
			if (!t.id) return false;
			const status = String(t.status || "todo").trim();
			const loopVerdict = String(tasks[t.id]?.loop?.evidence?.verdict || "").trim();
			return status === "blocked" || loopVerdict === "blocked";
		})
		.map((t) => t.id);

	const openTaskIds = sortedEntries.filter((t) => isOpenTaskStatus(t.status)).map((t) => t.id);
	const inProgressIds = sortedEntries.filter((t) => isActiveTaskStatus(t.status)).map((t) => t.id);
	const todoIds = sortedEntries.filter((t) => String(t.status) === "todo").map((t) => t.id);

	return {
		version: 2,
		generated_at: nowIso(),
		health: lintHealth(lintReport) as any,
		source: {
			task_context_root: ".wiki/roadmap/tasks",
		},
		summary: {
			task_count: entries.length,
			open_count: openTaskIds.length,
			status_counts: (graphRoadmap as any).status_counts || statusCounts,
			priority_counts: priorityCounts,
		} as any,
		views: {
			ordered_task_ids: (graphRoadmap as any).task_ids || ordered,
			open_task_ids: (graphRoadmap as any).open_task_ids || openTaskIds,
			in_progress_task_ids: (graphRoadmap as any).in_progress_task_ids || inProgressIds,
			todo_task_ids: (graphRoadmap as any).todo_task_ids || todoIds,
			blocked_task_ids: (graphRoadmap as any).blocked_task_ids || blockedTaskIds,
			done_task_ids: (graphRoadmap as any).done_task_ids || sortedEntries.filter((t) => String(t.status) === "done").map((t) => t.id),
			cancelled_task_ids: (graphRoadmap as any).cancelled_task_ids || sortedEntries.filter((t) => String(t.status) === "cancelled").map((t) => t.id),
			recent_task_ids: (graphRoadmap as any).recent_task_ids || recentEntries.map((t) => t.id),
		},
		tasks,
	};
}

export function compactCodeArea(codePaths: string[]): string {
	const cleaned = codePaths.map((v) => String(v).trim()).filter(Boolean);
	if (cleaned.length === 0) return "—";
	if (cleaned.length === 1) return cleaned[0];
	const areas: string[] = [];
	for (const path of cleaned) {
		const head = path.split("/")[0];
		if (!areas.includes(head)) areas.push(head);
	}
	if (areas.length === 1) return `${areas[0]} +${cleaned.length - 1} more`;
	const visible = areas.slice(0, 2);
	const suffix = areas.length > visible.length ? ` +${areas.length - visible.length} more` : "";
	return visible.join(", ") + suffix;
}

export function pathStartsWithAny(path: string, prefixes: string[]): boolean {
	return prefixes.some((prefix) => path.startsWith(prefix));
}

export function specGroup(path: string, project: WikiProject): string {
	const specsRoot = project.config.specs_root || project.docsRoot || ".wiki/knowledge";
	const PRODUCT_SPEC_PREFIX = `${specsRoot}/product/`;
	const CLIENTS_SPEC_PREFIXES = [`${specsRoot}/clients/`, `${specsRoot}/ux/`];
	if (path.startsWith(PRODUCT_SPEC_PREFIX)) return "product";
	if (pathStartsWithAny(path, CLIENTS_SPEC_PREFIXES)) return "clients";
	return "system";
}

export function specRequiresCodeMapping(path: string, project: WikiProject): boolean {
	const specsRoot = project.config.specs_root || project.docsRoot || ".wiki/knowledge";
	const SYSTEM_SPEC_PREFIX = `${specsRoot}/system/`;
	if (!path.startsWith(SYSTEM_SPEC_PREFIX)) return false;
	if (path.startsWith(`${SYSTEM_SPEC_PREFIX}runtime/`)) return false;
	// Architecture docs (components/, flows/) have code_paths from architecture manifest, not mapping
	if (path.startsWith(`${SYSTEM_SPEC_PREFIX}components/`)) return false;
	if (path.startsWith(`${SYSTEM_SPEC_PREFIX}flows/`)) return false;
	// Top-level system overview is an index, not a code boundary spec
	if (path === `${SYSTEM_SPEC_PREFIX}overview.md`) return false;
	return true;
}

export function barState(label: string, value: number, total: number) {
	const safeTotal = total > 0 ? total : 0;
	const percent = safeTotal > 0 ? Math.round((value / safeTotal) * 100) : 100;
	return {
		label,
		value: Math.floor(value),
		total: Math.floor(total),
		percent,
	};
}

export function unique(values: string[]): string[] {
	const seen: string[] = [];
	for (const value of values) {
		const text = String(value).trim();
		if (text && !seen.includes(text)) seen.push(text);
	}
	return seen;
}

export function laneStats(rows: any[]) {
	let aligned = 0, tracked = 0, untracked = 0, blocked = 0, unmapped = 0;
	for (const row of rows) {
		const drift = String(row.drift_status || "aligned");
		if (drift === "aligned") aligned++;
		else if (drift === "tracked") tracked++;
		else if (drift === "untracked") untracked++;
		else if (drift === "blocked") blocked++;
		else if (drift === "unmapped") unmapped++;
	}
	return {
		total_specs: rows.length,
		aligned_specs: aligned,
		tracked_specs: tracked,
		untracked_specs: untracked,
		blocked_specs: blocked,
		unmapped_specs: unmapped,
	};
}

import { GitCache } from "./git-cache";

export function previousHeartbeatLane(previousStatus: any, laneId: string): any {
	const heartbeat = previousStatus?.heartbeat || {};
	const lanes = Array.isArray(heartbeat.lanes) ? heartbeat.lanes : [];
	return lanes.find((lane: any) => String(lane.id).trim() === laneId) || null;
}

export function getTaskRevision(task: any) {
    return task.revision || { digest: canonicalDigest(task) };
}

export function laneRevisionAnchor(
    repoRoot: string,
	gitCache: GitCache,
	rowPaths: string[],
	codePaths: string[],
	openTaskIds: string[],
	specRowsByPath: Record<string, any>,
	roadmapEntries: any[],
    roadmapRelPath: string
) {
	const tasksById: Record<string, any> = {};
	for (const task of roadmapEntries) {
		const id = String(task.id || "").trim();
		if (id) tasksById[id] = task;
	}

	const specDigests: Record<string, string> = {};
	for (const path of rowPaths) {
		specDigests[path] = String(specRowsByPath[path]?.revision?.digest || "").trim();
	}

	const taskDigests: Record<string, string> = {};
	for (const taskId of openTaskIds) {
		if (tasksById[taskId]) {
			taskDigests[taskId] = String(getTaskRevision(tasksById[taskId])?.digest || "").trim();
		}
	}

	const codeDigests: Record<string, string> = {};
	for (const path of codePaths) {
		const absPath = join(repoRoot, path);
		if (existsSync(absPath) && statSync(absPath).isFile()) {
			codeDigests[path] = sha256Text(readFileSync(absPath, "utf-8"));
		}
	}

    const gitPaths = [...rowPaths, ...codePaths, roadmapRelPath];
    const gitAnchor = gitCache.buildAnchor(gitPaths);

	const anchor: any = {
		git: gitAnchor,
		spec_digest: canonicalDigest(specDigests),
		task_digest: canonicalDigest(taskDigests),
		code_digest: canonicalDigest(codeDigests),
	};
	anchor.digest = canonicalDigest(anchor);
	return anchor;
}

export function laneFreshness(anchor: any, previousLane: any, checkedAt: string) {
	if (!previousLane) {
		return {
			status: "fresh",
			basis: "revision",
			checked_at: checkedAt,
			reason: "no previous heartbeat anchor; current revision captured",
			stale_state_guidance: "Resume normally; future spec, task, or mapped code revision changes will mark this lane stale.",
		};
	}
	const previousAnchor = previousLane.revision || {};
	const changed: string[] = [];
	for (const key of ["spec_digest", "task_digest", "code_digest"]) {
		if (String(anchor[key] || "") !== String(previousAnchor[key] || "")) {
			changed.push(key.replace("_digest", ""));
		}
	}
	if (changed.length > 0) {
		return {
			status: "stale",
			basis: "revision",
			checked_at: checkedAt,
			reason: `revision changed: ${changed.join(", ")}`,
			stale_state_guidance: "Re-run status or resume implementation before trusting prior drift analysis.",
		};
	}
	return {
		status: "fresh",
		basis: "revision",
		checked_at: checkedAt,
		reason: "revision anchors unchanged since previous heartbeat",
		stale_state_guidance: "Prior drift analysis remains correlated with current spec, task, and mapped code revisions.",
	};
}

export function buildHeartbeatLane(
    repoRoot: string,
    gitCache: GitCache,
    roadmapRelPath: string,
	laneId: string,
	title: string,
	cadence: string,
	fallbackMaxAgeHours: number,
	triggers: string[],
	specPaths: string[],
	specRowsByPath: Record<string, any>,
	roadmapEntries: any[],
	recommendation: any,
	previousStatus: any
) {
	const rows = specPaths.map((p) => specRowsByPath[p]).filter(Boolean);
	const rowPaths = rows.map((r) => String(r.path || "").trim()).filter(Boolean);

	const allCodePaths: string[] = [];
	for (const row of rows) {
		const cps = Array.isArray(row.code_paths) ? row.code_paths : [];
		for (const cp of cps) {
			const text = String(cp).trim();
			if (text) allCodePaths.push(text);
		}
	}
	const codePaths = unique(allCodePaths);

	const openTaskIds: string[] = [];
	for (const task of roadmapEntries) {
		const taskId = String(task.id || "").trim();
		if (!taskId || !isOpenTaskStatus(task.status)) continue;

		const taskSpecPaths = Array.isArray(task.spec_paths) ? task.spec_paths.map((v: any) => String(v).trim()) : [];
		const taskCodePaths = Array.isArray(task.code_paths) ? task.code_paths.map((v: any) => String(v).trim()) : [];

		const specIntersection = taskSpecPaths.some((p: string) => rowPaths.includes(p));
		const codeIntersection = taskCodePaths.some((p: string) => codePaths.includes(p));

		if (specIntersection || codeIntersection) {
			openTaskIds.push(taskId);
		}
	}

	const checkedAt = nowIso();
	const normalizedOpenTaskIds = unique(openTaskIds);
	const revision = laneRevisionAnchor(repoRoot, gitCache, rowPaths, codePaths, normalizedOpenTaskIds, specRowsByPath, roadmapEntries, roadmapRelPath);
	const prevLane = previousHeartbeatLane(previousStatus, laneId);

	return {
		id: laneId,
		title,
		cadence,
		freshness_basis: "work-first",
		fallback_max_age_hours: fallbackMaxAgeHours,
		interval_hours: fallbackMaxAgeHours,
		triggers,
		checked_at: checkedAt,
		revision,
		freshness: laneFreshness(revision, prevLane, checkedAt),
		spec_paths: rowPaths,
		code_paths: codePaths,
		code_area: compactCodeArea(codePaths),
		open_task_ids: normalizedOpenTaskIds,
		risky_spec_paths: rowPaths.filter((p) => String(specRowsByPath[p]?.drift_status || "aligned") !== "aligned"),
		stats: laneStats(rows),
		recommendation,
	};
}

export function buildResumeState(roadmapState: RoadmapStateFile, heartbeatLanes: any[], nextStep: any): any {
	const views: any = roadmapState.views || {};
	const tasks: any = roadmapState.tasks || {};
	const inProgressIds = views.in_progress_task_ids || [];
	const todoIds = views.todo_task_ids || [];
	const openTaskId = [...inProgressIds, ...todoIds, ""][0];
	const task = openTaskId ? tasks[openTaskId] : null;

	if (task) {
		const goal: any = task.goal || {};
		const verification = Array.isArray(goal.verification) ? goal.verification : [];
		const loop: any = task.loop || {};
		const evidence: any = loop.evidence || {};
		const evidenceParts = [String(evidence.summary || "").trim()].filter(Boolean);
		const checksRun = Array.isArray(evidence.checks_run) ? evidence.checks_run : [];
		const issues = Array.isArray(evidence.issues) ? evidence.issues : [];

		if (checksRun.length) evidenceParts.push(`${checksRun.length} check(s)`);
		if (issues.length) evidenceParts.push(`${issues.length} issue(s)`);

		const evidenceText = evidenceParts.join(" · ") || "No closure evidence recorded yet.";
		const phase = normalizeTaskPhase(loop.phase);

		return {
			source: "task",
			task_id: openTaskId,
			lane_id: "",
			heading: `${openTaskId} — ${String(task.title || "").trim()}`.replace(/—\s*$/, "").trim(),
			command: `/wiki-resume ${openTaskId}`,
			reason: `Resume roadmap task (${String(task.status || "todo").trim()} · ${phase}).`,
			phase,
			verification: verification[0] || "No explicit verification step yet.",
			evidence: evidenceText,
			heartbeat: "Roadmap task should stay grounded in current heartbeat cues.",
		};
	}

	let staleLane = null;
	for (const lane of heartbeatLanes) {
		const freshness = lane.freshness || {};
		const stats = lane.stats || {};
		if (
			freshness.status === "stale" ||
			lane.risky_spec_paths?.length > 0 ||
			lane.open_task_ids?.length > 0 ||
			stats.untracked_specs > 0 ||
			stats.blocked_specs > 0
		) {
			staleLane = lane;
			break;
		}
	}

	if (staleLane) {
		return {
			source: "heartbeat",
			task_id: "",
			lane_id: String(staleLane.id || "").trim(),
			heading: String(staleLane.title || "").trim(),
			command: String(staleLane.recommendation?.command || "").trim(),
			reason: "Resume from stale heartbeat lane.",
			phase: "implement",
			verification: String(staleLane.recommendation?.reason || "").trim(),
			evidence: "No closure evidence recorded yet.",
			heartbeat:
				String(staleLane.freshness?.stale_state_guidance || "").trim() ||
				`${staleLane.risky_spec_paths?.length || 0} risky spec(s) and ${staleLane.open_task_ids?.length || 0} open task(s).`,
		};
	}

	return {
		source: "next_step",
		task_id: "",
		lane_id: "",
		heading: "Roadmap clear",
		command: String(nextStep.command || "").trim(),
		reason: String(nextStep.reason || "").trim(),
		phase: "implement",
		verification: "No urgent verification cue.",
		evidence: "No closure evidence recorded yet.",
		heartbeat: "All heartbeat lanes currently fresh.",
	};
}

const AGENT_NAME_POOL = [
	"Otter", "Kestrel", "Marten", "Heron", "Fox", "Raven", "Panda", "Lynx",
	"Badger", "Cormorant", "Falcon", "Tern", "Wren", "Puma", "Seal", "Yak",
	"Ibis", "Manta", "Orca", "Puffin", "Sable", "Swift", "Wolf", "Quail",
	"Mole", "Bison", "Gecko", "Jaguar", "Koala", "Narwhal", "Robin", "Stoat",
];

export function stableAgentName(sessionId: string): string {
	let value = 0;
	for (let i = 0; i < sessionId.length; i++) {
		value = (value * 33 + sessionId.charCodeAt(i)) >>> 0;
	}
	return AGENT_NAME_POOL[value % AGENT_NAME_POOL.length];
}

export function assignAgentNames(sessionIds: string[]): Record<string, string> {
	const used: Record<string, number> = {};
	const assigned: Record<string, string> = {};
	for (const sessionId of [...sessionIds].sort()) {
		const base = stableAgentName(sessionId);
		const count = (used[base] || 0) + 1;
		used[base] = count;
		assigned[sessionId] = count === 1 ? base : `${base} ${count}`;
	}
	return assigned;
}

export function buildParallelSessionState(events: any[], roadmapState: RoadmapStateFile) {
	const latestBySession: Record<string, any> = {};
	for (const event of events) {
		const kind = String(event.kind || "").trim();
		if (kind !== "task_session_link" && kind !== "roadmap_task_session_link") continue;
		const sessionId = String(event.session_id || "").trim();
		const taskId = String(event.task_id || event.taskId || "").trim();
		const timestamp = String(event.ts || "").trim();
		const action = String(event.action || "focus").trim() || "focus";

		if (!sessionId || !timestamp) continue;
		if (action === "clear") {
			delete latestBySession[sessionId];
			continue;
		}
		if (!taskId) continue;

		latestBySession[sessionId] = {
			session_id: sessionId,
			task_id: taskId,
			action,
			timestamp,
			title: String(event.title || "").trim(),
			summary: String(event.summary || "").trim(),
		};
	}

	const sessions = Object.values(latestBySession).sort((a: any, b: any) => {
		const d1 = String(a.timestamp || "");
		const d2 = String(b.timestamp || "");
		if (d1 !== d2) return d2.localeCompare(d1);
		return String(b.session_id || "").localeCompare(String(a.session_id || ""));
	});

	const agentNames = assignAgentNames(sessions.map((s: any) => String(s.session_id).trim()).filter(Boolean));
	for (const item of sessions) {
		item.agent_name = agentNames[item.session_id] || "Agent";
	}

	const counts: Record<string, number> = {};
	for (const item of sessions) {
		const taskId = item.task_id;
		if (taskId) counts[taskId] = (counts[taskId] || 0) + 1;
	}

	const collisionTaskIds = Object.keys(counts).filter((id) => counts[id] > 1).sort();

	return {
		generated_at: nowIso(),
		active_session_count: sessions.length,
		collision_task_ids: collisionTaskIds,
		sessions: sessions.slice(0, 8),
	};
}

export function buildStatusState(
	project: WikiProject,
	repoRoot: string,
	gitCache: GitCache,
	docs: ParsedDoc[],
	graph: GraphFile,
	roadmapEntries: RoadmapTaskRecord[],
	lintReport: LintReport,
	roadmapState: RoadmapStateFile,
	events: any[],
	previousStatus: any
): StatusStateFile {
	const health = lintHealth(lintReport);

	const docByPath: Record<string, ParsedDoc> = {};
	for (const doc of docs) {
		const path = String(doc.path || "").trim();
		if (path) docByPath[path] = doc;
	}

	const graphDocCodePaths: Record<string, string[]> = {};
	for (const edge of graph.edges || []) {
		if (String(edge.kind || "").trim() !== "doc_code_path") continue;
		const source = String(edge.from || "").trim();
		const target = String(edge.to || "").trim();
		if (!source.startsWith("doc:") || !target.startsWith("code:")) continue;
		const sourcePath = source.replace("doc:", "");
		const targetPath = target.replace("code:", "");
		if (!graphDocCodePaths[sourcePath]) graphDocCodePaths[sourcePath] = [];
		graphDocCodePaths[sourcePath].push(targetPath);
	}

	const graphSpecDocs: any[] = [];
	for (const node of graph.nodes || []) {
		if (String(node.kind || "").trim() !== "doc" || String((node as any).doc_type || "").trim() !== "spec") continue;
		const path = String(node.path || "").trim();
		if (!path) continue;
		const doc = docByPath[path] || ({} as any);
		const docCodePaths = Array.isArray(doc.code_paths) ? doc.code_paths : [];
		
		const mergedCodePaths = graphDocCodePaths[path] && graphDocCodePaths[path].length > 0 
			? graphDocCodePaths[path] 
			: docCodePaths.map(String).map((v) => v.trim()).filter(Boolean);

		graphSpecDocs.push({
			...doc,
			path,
			title: String(node.title || doc.title || path).trim(),
			summary: String(doc.summary || (node as any).summary || "").trim(),
			doc_type: "spec",
			code_paths: unique(mergedCodePaths),
			revision: (node as any).revision || (doc as any).revision || {},
		});
	}

	let specDocs = graphSpecDocs.length > 0 ? graphSpecDocs : docs.filter((d) => d.doc_type === "spec");
	specDocs = specDocs.sort((a, b) => String(a.path || "").localeCompare(String(b.path || "")));

	const issues = Array.isArray(lintReport.issues) ? lintReport.issues : [];
	const openTasksBySpec: Record<string, any[]> = {};
	const blockedTasksBySpec: Record<string, any[]> = {};
	const doneTasksBySpec: Record<string, any[]> = {};

	for (const task of roadmapEntries) {
		const specPaths = Array.isArray(task.spec_paths) ? task.spec_paths.map((v) => String(v).trim()).filter(Boolean) : [];
		const status = String(task.status || "todo");
		for (const specPath of specPaths) {
			if (status === "blocked") {
				if (!blockedTasksBySpec[specPath]) blockedTasksBySpec[specPath] = [];
				blockedTasksBySpec[specPath].push(task);
			} else if (isOpenTaskStatus(status)) {
				if (!openTasksBySpec[specPath]) openTasksBySpec[specPath] = [];
				openTasksBySpec[specPath].push(task);
			} else if (status === "done") {
				if (!doneTasksBySpec[specPath]) doneTasksBySpec[specPath] = [];
				doneTasksBySpec[specPath].push(task);
			}
		}
	}

	const specRows: any[] = [];
	const counts: Record<string, number> = { aligned: 0, tracked: 0, untracked: 0, blocked: 0, unmapped: 0 };
	const riskyPaths: string[] = [];

	const roadmapSortKey = (task: any) => {
		const statusOrder: Record<string, number> = { in_progress: 1, blocked: 2, todo: 3, research: 4, implement: 5, verify: 6, done: 7, cancelled: 8 };
		const p1 = statusOrder[String(task.status || "todo")] || 99;
		return `${p1.toString().padStart(3, "0")}_${String(task.id || "")}`;
	};

	for (const doc of specDocs) {
		const path = String(doc.path || "").trim();
		const codePaths = Array.isArray(doc.code_paths) ? doc.code_paths.map((v) => String(v).trim()).filter(Boolean) : [];
		const relatedIssues = issues.filter((issue: any) => {
			const issuePath = String(issue.path || "").trim();
			return issuePath === path || issuePath === path.replace("wiki/", "docs/");
		});
		
		const issueErrors = relatedIssues.filter((i: any) => String(i.severity) === "error").length;
		const issueWarnings = relatedIssues.filter((i: any) => String(i.severity) === "warning").length;
		
		const openTasks = (openTasksBySpec[path] || []).sort((a, b) => roadmapSortKey(a).localeCompare(roadmapSortKey(b)));
		const blockedTasks = (blockedTasksBySpec[path] || []).sort((a, b) => roadmapSortKey(a).localeCompare(roadmapSortKey(b)));
		const doneTasks = (doneTasksBySpec[path] || []).sort((a, b) => roadmapSortKey(a).localeCompare(roadmapSortKey(b)));

		const requiresMapping = specRequiresCodeMapping(path, project);

		let driftStatus = "aligned";
		let primaryTask = null;
		let note = "no deterministic drift signals";

		if (blockedTasks.length > 0 && openTasks.length === 0) {
			driftStatus = "blocked";
			primaryTask = blockedTasks[0];
			note = `blocked by ${primaryTask.id || "task"}`;
		} else if (openTasks.length > 0) {
			driftStatus = "tracked";
			primaryTask = openTasks[0];
			note = `tracked by ${primaryTask.id || "task"}`;
		} else if (codePaths.length === 0 && requiresMapping) {
			driftStatus = "unmapped";
			primaryTask = null;
			note = "no mapped code area";
		} else if (relatedIssues.length > 0) {
			driftStatus = "untracked";
			primaryTask = null;
			const issueTotal = issueErrors + issueWarnings;
			note = `${issueTotal} deterministic issue${issueTotal !== 1 ? "s" : ""} with no open roadmap task`;
		} else {
			driftStatus = "aligned";
			primaryTask = doneTasks.length > 0 ? doneTasks[0] : null;
		}

		counts[driftStatus] = (counts[driftStatus] || 0) + 1;
		if (driftStatus !== "aligned") riskyPaths.push(path);

		specRows.push({
			path,
			title: String(doc.title || path).trim(),
			summary: String(doc.summary || "").trim(),
			drift_status: driftStatus,
			code_paths: codePaths,
			code_area: compactCodeArea(codePaths),
			issue_counts: { errors: issueErrors, warnings: issueWarnings, total: issueErrors + issueWarnings },
			related_task_ids: [...openTasks, ...blockedTasks, ...doneTasks].map((t) => String(t.id || "").trim()).filter(Boolean),
			primary_task: primaryTask ? { id: String(primaryTask.id || "").trim(), status: String(primaryTask.status || "").trim(), title: String(primaryTask.title || "").trim() } : null,
			revision: doc.revision || {},
			note,
		});
	}

	const statusOrder: Record<string, number> = { untracked: 0, blocked: 1, tracked: 2, unmapped: 3, aligned: 4 };
	const riskySpecs = specRows.sort((a, b) => {
		const o1 = statusOrder[String(a.drift_status || "aligned")] || 99;
		const o2 = statusOrder[String(b.drift_status || "aligned")] || 99;
		if (o1 !== o2) return o1 - o2;
		return String(a.path || "").localeCompare(String(b.path || ""));
	});

	const specRowsByPath: Record<string, any> = {};
	for (const row of specRows) specRowsByPath[row.path] = row;

	const mappingTargetSpecs = specRows.filter((row) => specRequiresCodeMapping(row.path, project));
	const totalSpecs = mappingTargetSpecs.length;
	const mappedSpecs = mappingTargetSpecs.filter((row) => String(row.drift_status) !== "unmapped").length;

	const driftTotal = (counts.tracked || 0) + (counts.untracked || 0) + (counts.blocked || 0);
	const trackedTotal = (counts.tracked || 0) + (counts.blocked || 0);
	const taskSummary: any = roadmapState.summary || {};
	const taskStatusCounts: any = taskSummary.status_counts || {};

	const specsRoot = project.config.specs_root || project.docsRoot || ".wiki/knowledge";
	const PRODUCT_SPEC_PREFIX = `${specsRoot}/product/`;
	const SYSTEM_SPEC_PREFIX = `${specsRoot}/system/`;
	const CLIENTS_SPEC_PREFIXES = [`${specsRoot}/clients/`, `${specsRoot}/ux/`];

	const productSpecPaths = specRows.filter((r) => r.path.startsWith(PRODUCT_SPEC_PREFIX)).map((r) => r.path);
	const systemSpecPaths = specRows.filter((r) => r.path.startsWith(SYSTEM_SPEC_PREFIX)).map((r) => r.path);
	const uxSpecPaths = specRows.filter((r) => pathStartsWithAny(r.path, CLIENTS_SPEC_PREFIXES)).map((r) => r.path);

	const heartbeatLanes = [
		buildHeartbeatLane(
			repoRoot, gitCache, project.roadmapPath,
			"product_system", "Product ↔ System", "low", 24,
			["spec_change:product", "spec_change:system", "task_close:architecture", "manual_review"],
			unique([...productSpecPaths, ...systemSpecPaths]),
			specRowsByPath, roadmapEntries,
			{ kind: "status", command: "/wiki-status", reason: "Strategic intent drift should first be inspected through the canonical status surface." },
			previousStatus
		),
		buildHeartbeatLane(
			repoRoot, gitCache, project.roadmapPath,
			"system_code", "System ↔ Code", "high", 1,
			["spec_change:system", "code_change:mapped", "task_progress", "rebuild_complete", "pre_close_check"],
			unique(systemSpecPaths),
			specRowsByPath, roadmapEntries,
			{ kind: "implement", command: "/wiki-resume", reason: "Implementation drift should be checked most frequently against owning system specs." },
			previousStatus
		),
		buildHeartbeatLane(
			repoRoot, gitCache, project.roadmapPath,
			"product_system_ux", "Product + System ↔ UX", "medium", 6,
			["spec_change:product", "spec_change:system", "spec_change:ux", "code_change:ux_surface", "manual_review"],
			unique([...productSpecPaths, ...systemSpecPaths, ...uxSpecPaths]),
			specRowsByPath, roadmapEntries,
			{ kind: "status", command: "/wiki-status", reason: "User-visible drift should first be inspected through the canonical status surface." },
			previousStatus
		),
	];

	let nextStep: any;
	if (counts.untracked > 0) {
		nextStep = { kind: "status", command: "/wiki-status", reason: `${counts.untracked} untracked spec drift needs inspection through the canonical status surface.` };
	} else if (counts.blocked > 0 || (taskStatusCounts.blocked || 0) > 0) {
		nextStep = { kind: "status", command: "/wiki-status", reason: "Blocked drift exists; inspect constraints in status before resuming implementation." };
	} else if (roadmapState.views?.in_progress_task_ids?.length) {
		nextStep = { kind: "code", command: `/wiki-resume ${roadmapState.views.in_progress_task_ids[0]}`, reason: "Roadmap already covers current delta; continue in-progress implementation." };
	} else if (roadmapState.views?.todo_task_ids?.length) {
		nextStep = { kind: "code", command: `/wiki-resume ${roadmapState.views.todo_task_ids[0]}`, reason: "Roadmap is ready; continue with the next open task." };
	} else {
		nextStep = { kind: "observe", command: "Observe — roadmap clear", reason: "No open deterministic drift requires action right now." };
	}

	const heartbeatSummary = {
		lane_count: heartbeatLanes.length,
		freshness_basis: "work-first",
		high_cadence_lane_ids: heartbeatLanes.filter((l) => l.cadence === "high").map((l) => l.id),
		medium_cadence_lane_ids: heartbeatLanes.filter((l) => l.cadence === "medium").map((l) => l.id),
		low_cadence_lane_ids: heartbeatLanes.filter((l) => l.cadence === "low").map((l) => l.id),
	};

	const parallel = buildParallelSessionState(events, roadmapState);
	const resume = buildResumeState(roadmapState, heartbeatLanes, nextStep);

	const wikiSections: Record<string, any> = {
		product: { id: "product", label: "Product", rows: [] },
		system: { id: "system", label: "System", rows: [] },
		clients: { id: "clients", label: "Clients", rows: [] },
	};
	for (const row of riskySpecs) {
		wikiSections[specGroup(row.path, project)].rows.push(row);
	}

	const roadmapColumns: any[] = [
		{ id: "todo", label: "Todo", task_ids: [] },
		{ id: "research", label: "Research", task_ids: [] },
		{ id: "implement", label: "Implement", task_ids: [] },
		{ id: "verify", label: "Verify", task_ids: [] },
		{ id: "done", label: "Done", task_ids: [] },
	];
	const roadmapTasks: any = roadmapState.tasks || {};
	const orderedTaskIds = Array.isArray(roadmapState.views?.ordered_task_ids) ? roadmapState.views.ordered_task_ids : [];
	for (const taskId of orderedTaskIds) {
		const task = roadmapTasks[taskId];
		if (!task || task.status === "cancelled") continue;
		const stage = roadmapTaskStage(task.status, task.loop?.phase);
		const col = roadmapColumns.find((c) => c.id === stage) || roadmapColumns[0];
		col.task_ids.push(task.id);
	}

	const direction = [
		nextStep.reason,
		`Parallel sessions: ${parallel.active_session_count} active, ${parallel.collision_task_ids.length} collision task(s).`,
		`Heartbeat lanes: ${heartbeatSummary.lane_count} work-first (high=${heartbeatSummary.high_cadence_lane_ids.length}, medium=${heartbeatSummary.medium_cadence_lane_ids.length}, low=${heartbeatSummary.low_cadence_lane_ids.length}).`,
		`Mapped specs: ${mappedSpecs}/${totalSpecs}.`,
	];
	if (driftTotal > 0) {
		direction.push(`Tracked drift coverage: ${trackedTotal}/${driftTotal}.`);
	} else {
		direction.push("No tracked spec drift is open.");
	}

	return {
		version: 1,
		generated_at: nowIso(),
		project: {
			name: project.config.project_name || "project",
			docs_root: project.docsRoot,
			roadmap_path: project.roadmapPath,
		},
		health: health as any,
		summary: {
			total_specs: totalSpecs,
			mapped_specs: mappedSpecs,
			aligned_specs: counts.aligned || 0,
			tracked_specs: counts.tracked || 0,
			untracked_specs: counts.untracked || 0,
			blocked_specs: counts.blocked || 0,
			unmapped_specs: counts.unmapped || 0,
			task_count: roadmapEntries.length,
			open_task_count: (roadmapState.views?.open_task_ids || []).length,
			done_task_count: (roadmapState.views?.done_task_ids || []).length,
		},
		bars: {
			tracked_drift: barState("Tracked Drift", trackedTotal, driftTotal),
			roadmap_done: barState("Roadmap Done", (roadmapState.views?.done_task_ids || []).length, roadmapEntries.length),
			spec_mapping: barState("Spec Mapping", mappedSpecs, totalSpecs),
		},
		views: {
			risky_spec_paths: riskyPaths,
			top_risky_spec_paths: riskyPaths.slice(0, 10),
			open_task_ids: roadmapState.views?.open_task_ids || [],
		},
		next_step: nextStep,
		direction,
		specs: specRows,
		heartbeat: {
			generated_at: nowIso(),
			summary: heartbeatSummary,
			lanes: heartbeatLanes,
		},
		resume,
		parallel,
		wiki: {
			rows: specRows,
			sections: Object.values(wikiSections) as any[],
		},
		roadmap: {
			focused_task_id: (roadmapState.views?.in_progress_task_ids || [])[0] || "",
			blocked_task_ids: roadmapState.views?.blocked_task_ids || [],
			in_progress_task_ids: roadmapState.views?.in_progress_task_ids || [],
			next_task_id: (roadmapState.views?.todo_task_ids || [])[0] || "",
			columns: roadmapColumns,
		},
		agents: {
			rows: parallel.sessions.map((s: any) => ({
				id: String(s.session_id || ""),
				label: String(s.agent_name || "Agent"),
				name: String(s.agent_name || "Agent"),
				task_id: String(s.task_id || ""),
				task_title: String((roadmapState.tasks || {})[s.task_id]?.title || ""),
				mode: "manual",
				status: "active",
				last_action: String(s.action || "focus"),
				constraint: "",
				session_id: String(s.session_id || ""),
			})),
		},
		channels: {
			add_label: "Add channel",
			rows: [],
		},
	} as unknown as StatusStateFile;
}
