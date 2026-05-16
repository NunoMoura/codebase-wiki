import assert from "node:assert/strict";
import { buildGraph } from "../../src/application/graph.ts";

const project = {
	root: "/tmp/codewiki-alignment-graph",
	label: "alignment-graph-smoke",
	config: {
		project_name: "alignment-graph-smoke",
		schema_version: 4,
		specs_root: ".codewiki/kb",
		generated_files: [".codewiki/index_graph.json"],
		codewiki: { gateway: { generated_readonly_paths: [".codewiki/index_graph.json"] } },
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
};

const gitCache = { getDirtyPaths: () => [] };
const claims = { version: 1, claims: [] };
const docs = [
	{
		path: ".codewiki/kb/system/alignment.md",
		title: "Alignment",
		doc_type: "spec",
		links: [],
		code_paths: ["src/application/graph.ts"],
	},
];

function baseGraph(overrides = {}) {
	return buildGraph({
		project,
		docs,
		research: [],
		roadmapEntries: [],
		roadmapSprints: [],
		archivedTaskIds: [],
		gitCache,
		builds: [],
		validations: [],
		testFiles: [],
		claims,
		lintReport: { issues: [], counts: {}, status: "green" },
		...overrides,
	});
}

const feedbackPath = ".codewiki/builds/feedback/intent.json";
const documentationPath = ".codewiki/builds/documentation/docs.json";
const planningPath = ".codewiki/builds/planning/plan.json";
const implementationPath = ".codewiki/builds/implementation/impl.json";
const validationPath = ".codewiki/validation/impl-pass.json";
const checkedSha = "abc1234def5678abc1234def5678abc1234def5678";

const feedbackBuild = {
	path: feedbackPath,
	kind: "feedback_build",
	status: "accepted",
	data: {
		kind: "feedback_build",
		lifecycle: { state: "accepted" },
		diff_table: [{ id: "CHANGE-001", desired_state: "Align all layers.", user_action: "approved" }],
		lower_layer_delta: { knowledge: ["document"], roadmap: ["plan"], code: ["src/application/graph.ts"] },
	},
};
const documentationBuild = {
	path: documentationPath,
	kind: "documentation_build",
	status: "accepted",
	data: {
		kind: "documentation_build",
		lifecycle: { state: "accepted" },
		source_feedback_build: feedbackPath,
		produces: { knowledge: [".codewiki/kb/system/alignment.md"] },
	},
};
const planningBuild = {
	path: planningPath,
	kind: "planning_build",
	status: "accepted",
	data: {
		kind: "planning_build",
		lifecycle: { state: "accepted" },
		source_documentation_build: documentationPath,
		task_ids: ["TASK-900"],
		produces: { roadmap: ["TASK-900"] },
	},
};
const implementationBuild = {
	path: implementationPath,
	kind: "implementation_build",
	taskId: "TASK-900",
	status: "accepted",
	data: {
		kind: "implementation_build",
		lifecycle: { state: "accepted" },
		source_planning_build: planningPath,
		task_id: "TASK-900",
		produces: {
			code: ["src/application/graph.ts"],
			tests: ["tests/smoke/alignment-graph.test.mjs"],
			publication: ["package:codewiki"],
		},
		code_files: ["src/application/graph.ts"],
		test_files: ["tests/smoke/alignment-graph.test.mjs"],
		audit_refs: ["audit:file-structure"],
	},
};
const validationReport = {
	path: validationPath,
	taskId: "TASK-900",
	verdict: "pass",
	data: {
		profile: "implementation",
		verdict: "pass",
		source: implementationPath,
		audit_refs: ["audit:file-structure"],
		isolation: { role: "validator", fresh_context: true, clean: true, validated_sha: checkedSha },
	},
};

{
	const graph = baseGraph({
		roadmapEntries: [
			{ id: "TASK-900", title: "Implement graph", status: "todo", priority: "critical", kind: "architecture", summary: "Graph work.", spec_paths: [".codewiki/kb/system/alignment.md"], code_paths: ["src/application/graph.ts"], research_ids: [] },
		],
		builds: [feedbackBuild, documentationBuild, planningBuild, implementationBuild],
		validations: [validationReport],
	});
	const alignment = graph.views.alignment;
	assert.equal(alignment.model, "derived-vertical-state-machine");
	assert.deepEqual(alignment.precedence.slice(0, 2), ["content_proof", "canonical_source"], "Content proof must outrank validation reports and graph state");
	assert.ok(alignment.canonical_source_refs.includes(implementationPath), "Build path should appear as canonical source ref");
	assert.ok(alignment.audit_evidence_refs.includes("audit:file-structure"), "Audit evidence should be indexed separately");
	assert.ok(alignment.content_proof_refs.includes(checkedSha), "Validation checked SHA should be indexed as content proof");
	assert.ok(alignment.validation_attestations.some((row) => row.path === validationPath && row.content_proof_refs.includes(checkedSha)), "Validation report should be an attestation over content proof");
	assert.ok(graph.nodes.some((node) => node.id === `content_proof:${checkedSha}` && node.kind === "content_proof"), "Content proof node missing");
	assert.ok(graph.edges.some((edge) => edge.kind === "validation_content_proof" && edge.to === `content_proof:${checkedSha}`), "Validation should link to content proof node");
}

{
	const graph = baseGraph({ builds: [feedbackBuild] });
	assert.ok(graph.views.reconciliation.items.some((item) => item.source_id === `build:${feedbackPath}` && item.next_loop === "documentation"), "Accepted feedback without docs should route to documentation");
}

{
	const graph = baseGraph({ builds: [feedbackBuild, documentationBuild] });
	assert.ok(graph.views.reconciliation.items.some((item) => item.source_id === `build:${documentationPath}` && item.next_loop === "planning"), "Documentation build with lower-layer delta should route to planning when no planning evidence exists");
}

{
	const graph = baseGraph({
		roadmapEntries: [
			{ id: "TASK-900", title: "Implement graph", status: "todo", priority: "critical", kind: "architecture", summary: "Graph work.", spec_paths: [".codewiki/kb/system/alignment.md"], code_paths: ["src/application/graph.ts"], research_ids: [] },
		],
		builds: [feedbackBuild, documentationBuild, planningBuild],
	});
	assert.ok(graph.views.reconciliation.items.some((item) => item.task_id === "TASK-900" && item.next_loop === "implementation"), "Open roadmap task should route to implementation");
}

{
	const graph = baseGraph({
		roadmapEntries: [
			{ id: "TASK-900", title: "Implement graph", status: "todo", priority: "critical", kind: "architecture", summary: "Graph work.", spec_paths: [".codewiki/kb/system/alignment.md"], code_paths: ["src/application/graph.ts"], research_ids: [] },
		],
		builds: [feedbackBuild, documentationBuild, planningBuild, implementationBuild],
	});
	assert.ok(graph.views.reconciliation.items.some((item) => item.source_id === `build:${implementationPath}` && item.next_loop === "validation"), "Accepted implementation build without validation should route to validation");
	assert.ok(graph.views.reconciliation.items.some((item) => item.id === `reconcile:publication-proof:${implementationPath}` && item.next_loop === "validation"), "Publication claim without content proof should route to validation");
	const row = graph.views.traceability.rows.find((entry) => entry.requirement_id === "CHANGE-001");
	assert.ok(row?.gaps.includes("missing_publication_content_proof"), "Traceability should expose missing publication/content-proof edge");
}

{
	const graph = baseGraph({
		roadmapEntries: [
			{ id: "TASK-900", title: "Implement graph", status: "todo", priority: "critical", kind: "architecture", summary: "Graph work.", spec_paths: [], code_paths: [], research_ids: [] },
			{ id: "TASK-CLOSED", title: "Closed", status: "done", priority: "low", kind: "testing", summary: "Closed task.", spec_paths: [], code_paths: [], research_ids: [] },
		],
		validations: [
			{ path: ".codewiki/validation/open-fail.json", taskId: "TASK-900", verdict: "fail", data: { profile: "implementation", verdict: "fail" } },
			{ path: ".codewiki/validation/closed-fail.json", taskId: "TASK-CLOSED", verdict: "fail", data: { profile: "implementation", verdict: "fail" } },
		],
	});
	assert.ok(graph.views.reconciliation.items.some((item) => item.source_id === "validation:.codewiki/validation/open-fail.json"), "Active-task fail validation should route drift");
	assert.ok(!graph.views.reconciliation.items.some((item) => item.source_id === "validation:.codewiki/validation/closed-fail.json"), "Closed-task fail validation should not route current drift");
}
