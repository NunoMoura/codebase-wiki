import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { LintIssue, LintReport, RoadmapTaskRecord, WikiProject } from "../core/types";
import { ParsedDoc, extractLinks } from "./parser";

const DEFAULT_REQUIRED_FIELDS = ["id", "title", "state", "summary", "owners", "updated"];
const FORBIDDEN_HEADINGS = [
	"## Introduction",
	"## Overview",
	"## Table of contents",
	"## Background",
];
const WORD_COUNT_WARN = 1000;
const WORD_COUNT_EXEMPT = new Set([".wiki/roadmap.md", "index.md"]);

export function createIssue(severity: string, kind: string, path: string, message: string): LintIssue {
	return { severity, kind, path, message };
}

export function lintMarkdownDocs(repoRoot: string, docs: ParsedDoc[]): LintIssue[] {
	const issues: LintIssue[] = [];
	const ids = new Map<string, number>();

	for (const doc of docs) {
		const docId = `doc:${doc.path}`;
		ids.set(docId, (ids.get(docId) || 0) + 1);

		for (const field of DEFAULT_REQUIRED_FIELDS) {
			const val = doc.frontmatter[field];
			if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
				issues.push(createIssue("error", "missing-field", doc.path, `Missing required frontmatter field: ${field}`));
			}
		}

		if ((ids.get(docId) || 0) > 1) {
			issues.push(createIssue("error", "duplicate-id", doc.path, `Duplicate id: ${docId}`));
		}

		for (const rawTarget of extractLinks(repoRoot, doc.body, doc.path)) {
			// Links are pre-normalized by extractLinks
			const targetAbs = resolve(repoRoot, rawTarget);
			if (!existsSync(targetAbs)) {
				issues.push(createIssue("error", "broken-link", doc.path, `Broken link: ${rawTarget}`));
			}
		}

		for (const codePath of doc.code_paths) {
			const candidate = resolve(repoRoot, codePath);
			if (!existsSync(candidate)) {
				issues.push(createIssue("warning", "missing-code-path", doc.path, `Referenced code path does not exist: ${codePath}`));
			}
		}

		const wordCount = doc.body.split(/\s+/).length;
		if (!WORD_COUNT_EXEMPT.has(doc.path) && wordCount > WORD_COUNT_WARN) {
			issues.push(createIssue("warning", "large-doc", doc.path, `Live doc has ${wordCount} words; consider split or cut.`));
		}

		for (const heading of FORBIDDEN_HEADINGS) {
			if (doc.body.includes(heading)) {
				issues.push(createIssue("warning", "forbidden-heading", doc.path, `Forbidden heading in live doc: ${heading}`));
			}
		}

		if (!doc.body.includes("## Related docs")) {
			issues.push(createIssue("warning", "missing-related-docs", doc.path, "Live doc should end with '## Related docs'."));
		}
	}

	return issues;
}

export function lintRoadmapEntries(repoRoot: string, project: WikiProject, entries: RoadmapTaskRecord[], research: any[]): LintIssue[] {
	const issues: LintIssue[] = [];
	const seenIds = new Set<string>();
	const allowedStatus = new Set(["todo", "research", "implement", "verify", "done", "cancelled", "in_progress", "blocked"]);
	const allowedPriority = new Set(["critical", "high", "medium", "low"]);
	const sourcePath = project.roadmapPath;

	const researchIds = new Set<string>();
	for (const collection of research) {
		for (const entry of (collection.entries || [])) {
			if (entry.id) researchIds.add(entry.id);
		}
	}

	entries.forEach((entry, idx) => {
		const index = idx + 1;
		const entryId = typeof entry.id === "string" ? entry.id.trim() : "";
		
		if (!entryId) {
			issues.push(createIssue("error", "roadmap-missing-id", sourcePath, `Entry ${index} missing task id`));
			return;
		}

		if (seenIds.has(entryId)) {
			issues.push(createIssue("error", "roadmap-duplicate-id", sourcePath, `Duplicate roadmap task id: ${entryId}`));
		}
		seenIds.add(entryId);

		const requiredFields: (keyof RoadmapTaskRecord)[] = ["title", "status", "priority", "kind", "summary", "created", "updated"];
		for (const field of requiredFields) {
			if (!String(entry[field] || "").trim()) {
				issues.push(createIssue("error", `roadmap-missing-${field}`, sourcePath, `${entryId} missing ${field}`));
			}
		}

		const status = String(entry.status || "todo");
		if (!allowedStatus.has(status)) {
			issues.push(createIssue("error", "roadmap-bad-status", sourcePath, `${entryId} has invalid status: ${status}`));
		}

		const priority = String(entry.priority || "medium");
		if (!allowedPriority.has(priority)) {
			issues.push(createIssue("error", "roadmap-bad-priority", sourcePath, `${entryId} has invalid priority: ${priority}`));
		}

		const specPaths = entry.spec_paths || [];
		const codePaths = entry.code_paths || [];
		const goal = entry.goal || ({} as any);

		const outcome = String(goal.outcome || "").trim();
		const acceptance = Array.isArray(goal.acceptance) ? goal.acceptance : [];
		const verification = Array.isArray(goal.verification) ? goal.verification : [];
		const nonGoals = Array.isArray(goal.non_goals) ? goal.non_goals : [];

		if (Object.keys(goal).length > 0 && !outcome && acceptance.length === 0 && nonGoals.length === 0 && verification.length === 0) {
			issues.push(createIssue("warning", "roadmap-empty-goal", sourcePath, `${entryId} includes a goal object with no meaningful content`));
		}

		if (Object.keys(goal).length > 0 && verification.length === 0) {
			issues.push(createIssue("warning", "roadmap-missing-verification", sourcePath, `${entryId} goal should define at least one verification step`));
		}

		if (specPaths.length === 0 && codePaths.length === 0) {
			issues.push(createIssue("warning", "roadmap-unscoped", sourcePath, `${entryId} should reference at least one spec_paths or code_paths entry`));
		}

		for (const specPath of specPaths) {
			if (!existsSync(resolve(repoRoot, specPath))) {
				issues.push(createIssue("error", "roadmap-missing-spec-path", sourcePath, `${entryId} references missing spec path: ${specPath}`));
			}
		}

		for (const codePath of codePaths) {
			if (!existsSync(resolve(repoRoot, codePath))) {
				issues.push(createIssue("warning", "roadmap-missing-code-path", sourcePath, `${entryId} references missing code path: ${codePath}`));
			}
		}

		for (const researchId of entry.research_ids || []) {
			if (!researchIds.has(researchId)) {
				issues.push(createIssue("warning", "roadmap-missing-research-id", sourcePath, `${entryId} references unknown research id: ${researchId}`));
			}
		}
	});

	return issues;
}

export function buildLintReport(repoRoot: string, project: WikiProject, docs: ParsedDoc[], roadmapEntries: RoadmapTaskRecord[], research: any[]): LintReport {
	const issues: LintIssue[] = [
		...lintMarkdownDocs(repoRoot, docs),
		...lintRoadmapEntries(repoRoot, project, roadmapEntries, research)
	];

	const counts: Record<string, number> = {};
	for (const issue of issues) {
		counts[issue.kind] = (counts[issue.kind] || 0) + 1;
	}

	return {
		generated_at: new Date().toISOString(),
		counts,
		issues
	};
}
