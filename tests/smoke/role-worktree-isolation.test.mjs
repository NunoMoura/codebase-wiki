import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mutateChangeClaims } from "../../src/application/claims.ts";
import { writeValidationReport } from "../../src/application/builds.ts";
import { buildGraph } from "../../src/application/graph.ts";

const root = await mkdtemp(join(tmpdir(), "codewiki-role-worktree-"));

const project = {
	root,
	label: "role-worktree-smoke",
	config: {
		project_name: "role-worktree-smoke",
		schema_version: 4,
		specs_root: ".codewiki/kb",
		generated_files: [".codewiki/index_graph.json"],
	},
	docsRoot: ".codewiki/kb",
	specsRoot: ".codewiki/kb",
	evidenceRoot: ".codewiki/evidence",
	researchRoot: ".codewiki/research",
	indexPath: ".codewiki/index.md",
	roadmapPath: ".codewiki/roadmap/queue.json",
	roadmapDocPath: ".codewiki/roadmap.md",
	roadmapEventsPath: "",
	metaRoot: ".codewiki",
	viewsRoot: ".codewiki/views",
	graphPath: ".codewiki/index_graph.json",
	lintPath: ".codewiki/index_graph.json",
	roadmapStatePath: ".codewiki/index_graph.json",
	statusStatePath: ".codewiki/index_graph.json",
	eventsPath: "",
	configPath: ".codewiki/config.json",
};

const fakeGitCache = { getDirtyPaths: () => [] };

try {
	const claimResult = await mutateChangeClaims(project, {
		action: "claim",
		mode: "write",
		role: "builder",
		taskId: "TASK-070",
		summary: "Build role/worktree metadata.",
		worktree: {
			worktree_path: "/tmp/codewiki-builder",
			branch: "cw/TASK-070-builder",
			base_sha: "abc1234",
			head_sha: "def5678",
			clean: true,
		},
		scopes: [{ layer: "code", path: "src/application/claims.ts" }],
	}, { sessionId: "builder-session", agentName: "Builder" });

	assert.equal(claimResult.claim.role, "builder");
	assert.equal(claimResult.claim.worktree.worktree_path, "/tmp/codewiki-builder");
	assert.equal(claimResult.claim.worktree.head_sha, "def5678");
	assert.match(claimResult.summary, /role=builder/);

	const validationResult = await writeValidationReport(project, {
		profile: "implementation",
		task_id: "TASK-070",
		verdict: "pass",
		rationale: "Validated from a clean fresh validator worktree.",
		checks: ["npm test"],
		source: ".codewiki/builds/implementation/2026-05-12-task-070.json",
		isolation: {
			role: "validator",
			fresh_context: true,
			worktree_path: "/tmp/codewiki-validator",
			branch: "validate/TASK-070",
			base_sha: "abc1234",
			head_sha: "def5678",
			validated_sha: "def5678",
			clean: true,
			builder_session_id: "builder-session",
			builder_claim_id: claimResult.claim.id,
			related_claim_ids: [claimResult.claim.id],
		},
	});

	const report = JSON.parse(await readFile(join(root, validationResult.path), "utf8"));
	assert.equal(report.isolation.role, "validator");
	assert.equal(report.isolation.fresh_context, true);
	assert.equal(report.isolation.validated_sha, "def5678");
	assert.equal(report.isolation.builder_claim_id, claimResult.claim.id);

	const claimsFile = JSON.parse(await readFile(join(root, ".codewiki/session/queue.json"), "utf8"));
	const graph = buildGraph({
		project,
		docs: [],
		research: [],
		roadmapEntries: [],
		gitCache: fakeGitCache,
		builds: [],
		validations: [{ path: validationResult.path, taskId: "TASK-070", verdict: "pass", data: report }],
		testFiles: [],
		claims: claimsFile,
	});

	const claimNode = graph.nodes.find((node) => node.id === `claim:${claimResult.claim.id}`);
	assert.equal(claimNode.role, "builder");
	assert.equal(claimNode.worktree.branch, "cw/TASK-070-builder");
	assert.equal(graph.views.claims.by_role.builder, 1);
	assert.equal(graph.views.claims.isolation[0].head_sha, "def5678");

	const validationNode = graph.nodes.find((node) => node.id === `validation:${validationResult.path}`);
	assert.equal(validationNode.isolation_status, "isolated");
	assert.equal(validationNode.isolation.validated_sha, "def5678");
	assert.equal(graph.views.validation.isolation[0].status, "isolated");
	assert.equal(graph.views.validation.isolation[0].builder_claim_id, claimResult.claim.id);
} finally {
	await rm(root, { recursive: true, force: true });
}
