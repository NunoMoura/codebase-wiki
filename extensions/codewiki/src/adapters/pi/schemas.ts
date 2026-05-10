import { Type } from "@sinclair/typebox";
import * as T from "../../domain/shared/types.ts";

export const subagentRoleSchema = Type.Union(
	T.SUBAGENT_ROLE_VALUES.map((value) => Type.Literal(value)),
);
export const subagentVerdictSchema = Type.Union(
	T.SUBAGENT_VERDICT_VALUES.map((value) => Type.Literal(value)),
);
export const subagentProposalKindSchema = Type.Union(
	T.SUBAGENT_PROPOSAL_VALUES.map((value) => Type.Literal(value)),
);
export const subagentBriefSchema = Type.Object({
	role: subagentRoleSchema,
	taskId: Type.Optional(Type.String({ minLength: 1 })),
	question: Type.Optional(Type.String({ minLength: 1 })),
	intent: Type.Optional(Type.String({ minLength: 1 })),
	budget: Type.Optional(
		Type.Object({
			targetTokens: Type.Optional(Type.Number()),
			maxFiles: Type.Optional(Type.Number()),
		}),
	),
	inputs: Type.Object({
		views: Type.Optional(Type.Array(Type.String())),
		spec_paths: Type.Optional(Type.Array(Type.String())),
		code_paths: Type.Optional(Type.Array(Type.String())),
		evidence_paths: Type.Optional(Type.Array(Type.String())),
		checks: Type.Optional(Type.Array(Type.String())),
	}),
	constraints: Type.Optional(Type.Array(Type.String())),
});
export const subagentResultSchema = Type.Object({
	role: subagentRoleSchema,
	verdict: subagentVerdictSchema,
	taskId: Type.Optional(Type.String({ minLength: 1 })),
	checks: Type.Array(Type.String()),
	acceptance: Type.Optional(
		Type.Array(
			Type.Object({
				criterion: Type.String(),
				status: Type.Union([
					Type.Literal("pass"),
					Type.Literal("fail"),
					Type.Literal("unknown"),
				]),
				reason: Type.String(),
			}),
		),
	),
	findings: Type.Array(Type.String()),
	issues: Type.Array(
		Type.Object({
			severity: Type.Union([
				Type.Literal("high"),
				Type.Literal("medium"),
				Type.Literal("low"),
			]),
			summary: Type.String(),
			evidence: Type.Optional(Type.String()),
		}),
	),
	proposals: Type.Array(
		Type.Object({
			kind: subagentProposalKindSchema,
			summary: Type.String(),
			paths: Type.Optional(Type.Array(Type.String())),
		}),
	),
	rationale: Type.String(),
});

export const roadmapPrioritySchema = Type.Union(
	T.ROADMAP_PRIORITY_VALUES.map((value) => Type.Literal(value)),
);
export const roadmapTaskGoalSchema = Type.Object({
	outcome: Type.Optional(
		Type.String({ description: "Clear outcome this task should achieve." }),
	),
	acceptance: Type.Optional(
		Type.Array(Type.String(), {
			description: "Concrete success signals proving the outcome was achieved.",
		}),
	),
	non_goals: Type.Optional(
		Type.Array(Type.String(), {
			description: "Explicitly out-of-scope work for this task.",
		}),
	),
	verification: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Checks, tests, or review steps required before closing the task.",
		}),
	),
});
export const codewikiTaskCreateSchema = Type.Object({
	title: Type.String({ minLength: 1, description: "Short task title." }),
	priority: roadmapPrioritySchema,
	kind: Type.String({
		minLength: 1,
		description:
			"Task kind like architecture, bug, migration, testing, docs, or agent-workflow.",
	}),
	summary: Type.String({
		minLength: 1,
		description: "One-sentence task summary.",
	}),
	spec_paths: Type.Optional(Type.Array(Type.String(), { default: [] })),
	code_paths: Type.Optional(Type.Array(Type.String(), { default: [] })),
	research_ids: Type.Optional(Type.Array(Type.String(), { default: [] })),
	labels: Type.Optional(Type.Array(Type.String(), { default: [] })),
	goal: Type.Optional(roadmapTaskGoalSchema),
	delta: Type.Optional(
		Type.Object({
			desired: Type.Optional(Type.String()),
			current: Type.Optional(Type.String()),
			closure: Type.Optional(Type.String()),
		}),
	),
});
export const taskLoopPhaseSchema = Type.Union([
	Type.Literal("implement"),
	Type.Literal("verify"),
]);
export const toolTaskStatusSchema = Type.Union(
	T.TOOL_TASK_STATUS_VALUES.map((value) => Type.Literal(value)),
);
export const taskEvidenceResultSchema = Type.Union(
	T.TASK_EVIDENCE_RESULT_VALUES.map((value) => Type.Literal(value)),
);
export const changeClaimActionSchema = Type.Union(
	T.CHANGE_CLAIM_ACTION_VALUES.map((value) => Type.Literal(value)),
);
export const changeClaimModeSchema = Type.Union(
	T.CHANGE_CLAIM_MODE_VALUES.map((value) => Type.Literal(value)),
);
export const changeClaimLayerSchema = Type.Union(
	T.CHANGE_CLAIM_LAYER_VALUES.map((value) => Type.Literal(value)),
);
export const changeClaimScopeSchema = Type.Object({
	layer: changeClaimLayerSchema,
	path: Type.Optional(Type.String({ description: "Repo-relative path or glob-like prefix, e.g. .codewiki/kb/system/**." })),
	task_id: Type.Optional(Type.String({ description: "Roadmap task id when layer is roadmap or the claim targets task state." })),
	ref: Type.Optional(Type.String({ description: "Build, validation, graph, branch, or other stable reference." })),
	description: Type.Optional(Type.String({ description: "Short human label when no path/task/ref fits." })),
});
export const codewikiStateSectionSchema = Type.Union(
	T.CODEWIKI_STATE_SECTION_VALUES.map((value) => Type.Literal(value)),
);
export const repoPathToolField = Type.Optional(
	Type.String({
		description:
			"Optional repo root, or any path inside the target repo, when the current cwd is outside that repo.",
	}),
);
export const agencyModeSchema = Type.Union(
	T.AGENCY_MODE_VALUES.map((value) => Type.Literal(value)),
);
export const agencyTriggerSchema = Type.Union(
	T.AGENCY_TRIGGER_VALUES.map((value) => Type.Literal(value)),
);
export const agencyRiskSchema = Type.Union(
	T.AGENCY_RISK_VALUES.map((value) => Type.Literal(value)),
);
export const codewikiAgencyToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	mode: Type.Optional(agencyModeSchema),
	trigger: Type.Optional(agencyTriggerSchema),
	budget: Type.Optional(
		Type.Object({
			maxCycles: Type.Optional(Type.Number()),
			maxWallSeconds: Type.Optional(Type.Number()),
			maxWrites: Type.Optional(Type.Number()),
			maxSubagents: Type.Optional(Type.Number()),
			risk: Type.Optional(agencyRiskSchema),
		}),
	),
	dryRun: Type.Optional(Type.Boolean()),
});

export const toolTaskIdField = Type.String({
	minLength: 1,
	description:
		"Existing task id. Canonical ids use TASK-###; legacy ROADMAP-### is still accepted during migration.",
});
export const codewikiTaskPatchSchema = Type.Object({
	title: Type.Optional(Type.String({ minLength: 1 })),
	priority: Type.Optional(roadmapPrioritySchema),
	kind: Type.Optional(Type.String({ minLength: 1 })),
	summary: Type.Optional(Type.String({ minLength: 1 })),
	status: Type.Optional(toolTaskStatusSchema),
	phase: Type.Optional(Type.Union([taskLoopPhaseSchema, Type.Null()])),
	spec_paths: Type.Optional(Type.Array(Type.String())),
	code_paths: Type.Optional(Type.Array(Type.String())),
	research_ids: Type.Optional(Type.Array(Type.String())),
	labels: Type.Optional(Type.Array(Type.String())),
	goal: Type.Optional(roadmapTaskGoalSchema),
	delta: Type.Optional(
		Type.Object({
			desired: Type.Optional(Type.String()),
			current: Type.Optional(Type.String()),
			closure: Type.Optional(Type.String()),
		}),
	),
});
export const codewikiTaskEvidenceSchema = Type.Object({
	summary: Type.String({
		minLength: 1,
		description: "Short evidence summary to append to task history.",
	}),
	result: Type.Optional(taskEvidenceResultSchema),
	checks_run: Type.Optional(Type.Array(Type.String(), { default: [] })),
	files_touched: Type.Optional(Type.Array(Type.String(), { default: [] })),
	issues: Type.Optional(Type.Array(Type.String(), { default: [] })),
});
export const codewikiStateToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	refresh: Type.Optional(
		Type.Boolean({
			default: false,
			description:
				"When true, rebuild derived graph/state files before reading.",
		}),
	),
	include: Type.Optional(
		Type.Array(codewikiStateSectionSchema, {
			uniqueItems: true,
			description:
				"Sections to include. Default: ['summary', 'roadmap', 'session'].",
		}),
	),
	taskId: Type.Optional(toolTaskIdField),
});
export const codewikiTaskToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	action: Type.Union([
		Type.Literal("create"),
		Type.Literal("update"),
		Type.Literal("close"),
		Type.Literal("cancel"),
		Type.Literal("clear-archive"),
		Type.Literal("checkpoint"),
	]),
	refresh: Type.Optional(
		Type.Boolean({
			default: true,
			description:
				"When true, rebuild generated view files after mutation.",
		}),
	),
	taskId: Type.Optional(toolTaskIdField),
	tasks: Type.Optional(Type.Array(codewikiTaskCreateSchema, { minItems: 1 })),
	patch: Type.Optional(codewikiTaskPatchSchema),
	evidence: Type.Optional(codewikiTaskEvidenceSchema),
	summary: Type.Optional(Type.String({ minLength: 1 })),
});
export const codewikiBuildLifecycleSchema = Type.Object({
	state: Type.Optional(Type.Union([
		Type.Literal("proposed"),
		Type.Literal("accepted"),
		Type.Literal("applied"),
		Type.Literal("validated"),
		Type.Literal("archived"),
	])),
	ttl_days: Type.Optional(Type.Number({ minimum: 1 })),
	archive_after: Type.Optional(Type.String()),
	purge_after: Type.Optional(Type.String()),
});
export const codewikiBuildToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	kind: Type.Union([
		Type.Literal("feedback"),
		Type.Literal("documentation"),
		Type.Literal("implementation"),
	], {
		description: "Build kind to create. feedback: user intent → knowledge. documentation: knowledge → roadmap. implementation: roadmap → tests/code.",
	}),
	summary: Type.String({ minLength: 1 }),
	slug: Type.Optional(Type.String({ minLength: 1 })),
	source: Type.Optional(Type.String({ minLength: 1 })),
	lifecycle: Type.Optional(codewikiBuildLifecycleSchema),
	refresh: Type.Optional(Type.Boolean({ default: true })),
	// Feedback-specific
	decisions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
	assumptions: Type.Optional(Type.Array(Type.String(), { default: [] })),
	open_questions: Type.Optional(Type.Array(Type.String(), { default: [] })),
	non_goals: Type.Optional(Type.Array(Type.String(), { default: [] })),
	lower_layer_delta: Type.Optional(Type.Object({
		knowledge: Type.Optional(Type.Array(Type.String(), { default: [] })),
		roadmap: Type.Optional(Type.Array(Type.String(), { default: [] })),
		code: Type.Optional(Type.Array(Type.String(), { default: [] })),
	})),
	// Documentation-specific
	source_feedback_build: Type.Optional(Type.String()),
	knowledge_changes: Type.Optional(Type.Array(Type.String())),
	roadmap_changes: Type.Optional(Type.Array(Type.String())),
	// Implementation-specific
	source_documentation_build: Type.Optional(Type.String()),
	task_id: Type.Optional(Type.String()),
	test_files: Type.Optional(Type.Array(Type.String())),
	code_files: Type.Optional(Type.Array(Type.String())),
	checks_run: Type.Optional(Type.Array(Type.String())),
	acceptance_mapping: Type.Optional(Type.Array(Type.Object({
		criterion: Type.String(),
		evidence: Type.String(),
	}))),
	test_design_evidence: Type.Optional(Type.Array(Type.String())),
	code_change_evidence: Type.Optional(Type.Array(Type.String())),
	tester_notes: Type.Optional(Type.Array(Type.String())),
	builder_notes: Type.Optional(Type.Array(Type.String())),
	validation_refs: Type.Optional(Type.Array(Type.String())),
	risks: Type.Optional(Type.Array(Type.String())),
	publication: Type.Optional(Type.Object({
		commit_title: Type.Optional(Type.String()),
		commit_body: Type.Optional(Type.String()),
		pr_title: Type.Optional(Type.String()),
		pr_body: Type.Optional(Type.String()),
		issue_update: Type.Optional(Type.String()),
		release_notes: Type.Optional(Type.String()),
	})),
});
export const codewikiValidationReportSchema = Type.Object({
	repoPath: repoPathToolField,
	profile: Type.String({
		minLength: 1,
		description: "Validation profile: feedback, documentation, implementation, task-close, drift-audit, etc.",
	}),
	task_id: Type.Optional(Type.String()),
	verdict: Type.Union([
		Type.Literal("pass"),
		Type.Literal("fail"),
		Type.Literal("block"),
	]),
	rationale: Type.String({ minLength: 1 }),
	checks: Type.Optional(Type.Array(Type.String())),
	issues: Type.Optional(Type.Array(Type.Object({
		severity: Type.String(),
		summary: Type.String(),
	}))),
	source: Type.Optional(Type.String()),
	refresh: Type.Optional(Type.Boolean({ default: true })),
});
export const codewikiSessionToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	action: Type.Union([
		Type.Literal("focus"),
		Type.Literal("note"),
		Type.Literal("clear"),
	]),
	taskId: Type.Optional(toolTaskIdField),
	summary: Type.Optional(Type.String({ minLength: 1 })),
	checks_run: Type.Optional(Type.Array(Type.String(), { default: [] })),
	files_touched: Type.Optional(Type.Array(Type.String(), { default: [] })),
	issues: Type.Optional(Type.Array(Type.String(), { default: [] })),
	setSessionName: Type.Optional(
		Type.Boolean({
			default: false,
			description: "Rename current Pi session to TASK-### + title.",
		}),
	),
});
export const codewikiClaimToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	action: changeClaimActionSchema,
	claimId: Type.Optional(Type.String({ minLength: 1, description: "Existing CLAIM-### id for release or heartbeat." })),
	taskId: Type.Optional(toolTaskIdField),
	buildRef: Type.Optional(Type.String({ minLength: 1, description: "Optional compiler build path anchoring this claim." })),
	summary: Type.Optional(Type.String({ minLength: 1, description: "Short reason for the claim." })),
	mode: Type.Optional(changeClaimModeSchema),
	scopes: Type.Optional(Type.Array(changeClaimScopeSchema, { minItems: 1 })),
	ttl_minutes: Type.Optional(Type.Number({ minimum: 1, description: "Lease TTL in minutes; default 120, max 1440." })),
	force: Type.Optional(Type.Boolean({ default: false, description: "Allow creation despite write/write claim conflicts." })),
	refresh: Type.Optional(Type.Boolean({ default: true, description: "Rebuild generated graph/status after claim mutation." })),
});
