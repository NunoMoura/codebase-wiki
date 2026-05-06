import { Type } from "@sinclair/typebox";
import * as T from "./types";

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
export const codewikiStateSectionSchema = Type.Union(
	T.CODEWIKI_STATE_SECTION_VALUES.map((value) => Type.Literal(value)),
);
export const repoPathToolField = Type.Optional(
	Type.String({
		description:
			"Optional repo root, or any path inside the target repo, when the current cwd is outside that repo.",
	}),
);
export const heartbeatModeSchema = Type.Union(
	T.HEARTBEAT_MODE_VALUES.map((value) => Type.Literal(value)),
);
export const heartbeatRiskSchema = Type.Union(
	T.HEARTBEAT_RISK_VALUES.map((value) => Type.Literal(value)),
);
export const codewikiHeartbeatToolInputSchema = Type.Object({
	repoPath: repoPathToolField,
	mode: Type.Optional(heartbeatModeSchema),
	budget: Type.Optional(
		Type.Object({
			maxCycles: Type.Optional(Type.Number()),
			maxWallSeconds: Type.Optional(Type.Number()),
			maxWrites: Type.Optional(Type.Number()),
			maxSubagents: Type.Optional(Type.Number()),
			risk: Type.Optional(heartbeatRiskSchema),
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
