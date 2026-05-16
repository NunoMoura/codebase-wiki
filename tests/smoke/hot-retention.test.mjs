import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLintReport } from "../../src/application/lint.ts";
import { buildGraph } from "../../src/application/graph.ts";

const root = await mkdtemp(join(tmpdir(), "codewiki-hot-retention-"));

const project = {
	root,
	label: "hot-retention-smoke",
	config: { project_name: "hot-retention-smoke", generated_files: [".codewiki/index_graph.json"], codewiki: { gc: {} } },
	docsRoot: ".codewiki/kb",
	specsRoot: ".codewiki/kb",
	evidenceRoot: "",
	researchRoot: ".codewiki/research",
	indexPath: "",
	roadmapPath: ".codewiki/roadmap/queue.json",
	roadmapDocPath: "",
	roadmapEventsPath: "",
	metaRoot: ".codewiki",
	viewsRoot: ".codewiki/views",
	graphPath: ".codewiki/index_graph.json",
	lintPath: ".codewiki/lint.json",
	roadmapStatePath: ".codewiki/index_graph.json",
	statusStatePath: ".codewiki/index_graph.json",
	eventsPath: "",
	configPath: ".codewiki/config.json",
};

try {
	await mkdir(join(root, ".codewiki/index"), { recursive: true });
	await mkdir(join(root, ".codewiki/evidence"), { recursive: true });
	await writeFile(join(root, ".codewiki/index/legacy.json"), "{}\n");
	await writeFile(join(root, ".codewiki/evidence/legacy.jsonl"), "{}\n");
	await writeFile(join(root, ".codewiki/config.json"), JSON.stringify({ notes: "legacy .wiki/path" }, null, 2));
	const lint = buildLintReport(root, project, [], [], [], { builds: [], validations: [], archivedTaskIds: [] });
	assert.ok(lint.issues.some((issue) => issue.kind === "deprecated-codewiki-index"), "Deprecated index path should be deterministic drift");
	assert.ok(lint.issues.some((issue) => issue.kind === "deprecated-codewiki-evidence"), "Deprecated evidence path should be deterministic drift");
	assert.ok(lint.issues.some((issue) => issue.kind === "stale-dotwiki-reference"), "Legacy dot-wiki path should be deterministic drift");

	const buildPath = ".codewiki/builds/implementation/2026-05-12-task-999.json";
	const validationPath = ".codewiki/validation/2026-05-12-task-close-pass-task-999.json";
	const graph = buildGraph({
		project,
		docs: [],
		research: [],
		roadmapEntries: [],
		archivedTaskIds: ["TASK-999"],
		gitCache: { getDirtyPaths: () => [] },
		builds: [{
			path: buildPath,
			kind: "implementation_build",
			status: "accepted",
			data: {
				kind: "implementation_build",
				task_id: "TASK-999",
				lifecycle: { state: "accepted" },
				publication: {
					archive_ledger: { kind: "task", id: "TASK-999", build_path: buildPath, archive_ref: "refs/codewiki/archive/task/TASK-999", digest: "sha256:abc", restore_command: "/wiki-restore TASK-999" },
					artifact_digests: { files: [{ path: "src/x.ts", role: "code_file", sha256: "sha256:def", bytes: 1 }] },
					push_readiness: { safe_to_push: true },
				},
			},
		}],
		validations: [{ path: validationPath, taskId: "TASK-999", verdict: "pass", data: { source: buildPath, verdict: "pass" } }],
		testFiles: [],
		claims: { version: 1, updated_at: "", next_sequence: 1, claims: [] },
	});
	assert.ok(graph.views.gc.classes.purgeable.build_paths.includes(buildPath), "Safe archived implementation build should be purgeable");
	assert.ok(graph.views.gc.classes.purgeable.validation_paths.includes(validationPath), "Pass validation for safe archived task should be purgeable");
	assert.equal(graph.views.gc.classes.hot.validation_paths.includes(validationPath), false, "Pass validation should not stay hot after safe archive");
	assert.equal(graph.views.archive.restore_index[0].archive_ref, "refs/codewiki/archive/task/TASK-999");
} finally {
	await rm(root, { recursive: true, force: true });
}
