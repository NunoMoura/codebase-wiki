import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
	WikiProject,
	CodewikiTaskToolInput,
	CodewikiTaskPatchInput,
	RoadmapTaskRecord,
	RoadmapStateTaskSummary,
	RoadmapTaskUpdateInput,
	ToolTaskStatus,
	TaskPhase,
	RoadmapStatus,
    RoadmapTaskUpdateFields,
    CodewikiTaskEvidenceInput,
} from "../../../domain/shared/types";
import { resolve, dirname } from "node:path";
import { mkdir, writeFile, appendFile, readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { withLockedPaths } from "../../../../mutation-queue";
import {
	nowIso,
	unique,
	formatError,
} from "../../../domain/shared/utils";
import {
	maybeReadRoadmapState,
	maybeReadGraph,
	runRebuild,
	maybeReadTaskContext,
} from "../../../application/state-artifacts";
import {
	readRoadmapTask,
	appendRoadmapTasks,
	updateRoadmapTask,
	updateTaskLoop,
    roadmapArchivePath,
    appendProjectEvent,
    appendTaskEvidenceEvent,
    hasCodewikiTaskPatchChanges,
    buildRoadmapTaskUpdateFromCodewikiPatch,
    appendCodewikiTaskEvidence,
    summarizeCodewikiTaskAction,
    hasRoadmapTaskUpdateFields,
    readRoadmapFile,
    writeRoadmapFile,
} from "../../../core/roadmap";
import { buildCodewikiTaskDetail } from "../../../application/state";
import {
	createCodewikiTasks,
	patchCodewikiTask,
	closeCodewikiTask,
	appendTaskEvidence,
	cancelCodewikiTask,
	type TaskMutationPorts,
} from "../../../application/task";

const execFileAsync = promisify(execFile);

async function collectCanonicalFiles(root: string, relPath: string): Promise<string[]> {
	const absPath = resolve(root, relPath);
	let info;
	try {
		info = await stat(absPath);
	} catch {
		return [];
	}
	if (info.isFile()) return [relPath];
	if (!info.isDirectory()) return [];
	const entries = await readdir(absPath, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const childRel = `${relPath}/${entry.name}`;
		if (entry.isDirectory()) files.push(...await collectCanonicalFiles(root, childRel));
		else if (entry.isFile()) files.push(childRel);
	}
	return files;
}

async function computeCanonicalDigest(project: WikiProject): Promise<string> {
	const roots = [
		".codewiki/config.json",
		".codewiki/kb",
		".codewiki/roadmap.json",
		".codewiki/builds",
		".codewiki/validation",
	];
	const files = (await Promise.all(roots.map((root) => collectCanonicalFiles(project.root, root))))
		.flat()
		.sort();
	const hash = createHash("sha256");
	for (const file of files) {
		hash.update(file);
		hash.update("\0");
		hash.update(await readFile(resolve(project.root, file)));
		hash.update("\0");
	}
	return `sha256:${hash.digest("hex")}`;
}

/**
 * Build TaskMutationPorts from Pi ExtensionContext.
 */
function piTaskPorts(ctx: ExtensionContext): TaskMutationPorts {
	return {
		fileStore: {
			readJson: async (path: string) => JSON.parse(await readFile(path, "utf8")),
			maybeReadJson: async (path: string) => {
				try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
			},
			writeJson: async (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2), "utf8"),
			appendJsonl: async (path: string, record: unknown) => appendFile(path, JSON.stringify(record) + "\n", "utf8"),
		},
		rebuildRunner: {
			run: async (proj: WikiProject) => {
				const { runConfiguredOrDefaultRebuild } = await import("../../../infrastructure/rebuild-runner");
				await runConfiguredOrDefaultRebuild(proj);
			},
		},
		messageBus: {
			send: (_message: string) => { /* Pi adapter silences task output to caller */ },
		},
	};
}

/**
 * Implementation of the codewiki_task tool.
 */
export async function executeCodewikiTask(
	pi: ExtensionAPI,
	project: WikiProject,
	ctx: ExtensionContext,
	input: CodewikiTaskToolInput,
) {
	const refresh = input.refresh ?? true;
	if (input.action === "clear-archive") {
		if (!input.summary?.trim()) {
			throw new Error(
				"codewiki_task clear-archive requires summary confirmation.",
			);
		}
		const archivePath = roadmapArchivePath(project);
		await withLockedPaths([archivePath], async () => {
			await mkdir(dirname(archivePath), { recursive: true });
			const compressed = archivePath.endsWith(".gz");
			await writeFile(archivePath, compressed ? gzipSync("") : "", "utf8");
		});
		await appendProjectEvent(project, {
			ts: nowIso(),
			kind: "roadmap_archive_cleared",
			title: "Cleared roadmap archive",
			summary: input.summary.trim(),
			path: archivePath.replace(`${project.root}/`, ""),
		});
		if (refresh) await runRebuild(project);
		return {
			action: "clear-archive" as const,
			changed: true,
			archive_path: archivePath.replace(`${project.root}/`, ""),
			summary: `codewiki task: cleared roadmap archive ${archivePath.replace(`${project.root}/`, "")}`,
		};
	}
	if (input.action === "checkpoint") {
		if (!input.summary?.trim()) {
			throw new Error("codewiki_task checkpoint requires summary as version or label.");
		}
		let gitSha = "unknown";
		try {
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: project.root });
			gitSha = stdout.trim();
		} catch {}
		let gitDirty = false;
		try {
			const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: project.root });
			gitDirty = stdout.trim().length > 0;
		} catch {}
		const graph = await maybeReadGraph(project.graphPath);
		const state = await maybeReadRoadmapState(project.roadmapStatePath);
		const canonicalDigest = await computeCanonicalDigest(project);
		const closedTasks = Object.values(state?.tasks ?? {}).filter(t => ["done", "cancelled"].includes(t.status)).map(t => ({
			id: t.id,
			title: t.title,
			status: t.status,
			closed_at: t.updated,
		}));
		const checkpointPath = resolve(project.root, ".codewiki/roadmap/release-checkpoints.jsonl");
		await withLockedPaths([checkpointPath], async () => {
			await mkdir(dirname(checkpointPath), { recursive: true });
			const record = {
				ts: nowIso(),
				version_label: input.summary.trim(),
				git_sha: gitSha,
				git_dirty: gitDirty,
				canonical_digest: canonicalDigest,
				view_schema_version: state?.version ?? 1,
				closed_tasks: closedTasks,
			};
			await appendFile(checkpointPath, JSON.stringify(record) + "\n", "utf8");
		});
		await appendProjectEvent(project, {
			ts: nowIso(),
			kind: "release_checkpoint_created",
			title: "Created release checkpoint",
			summary: input.summary.trim(),
			path: ".codewiki/roadmap/release-checkpoints.jsonl",
		});
		return {
			action: "checkpoint" as const,
			changed: true,
			summary: `codewiki task: created release checkpoint ${input.summary.trim()}`,
		};
	}
	if (input.action === "create") {
		if (!input.tasks?.length)
			throw new Error("codewiki_task create requires tasks.");
		const result = await createCodewikiTasks(project, input.tasks, piTaskPorts(ctx));
		const details = {
			action: "create" as const,
			changed: result.created.length > 0,
			canonical_task_ids: [...result.created, ...result.reused].map(
				(task) => task.id,
			),
			created: result.created.map((task) => ({
				id: task.id,
				title: task.title,
				status: task.status,
			})),
			reused: result.reused.map((task) => ({
				id: task.id,
				title: task.title,
				status: task.status,
			})),
			evidence_recorded: false,
			summary: "",
		};
		details.summary = summarizeCodewikiTaskAction(details);
		return details;
	}
	if (!input.taskId?.trim()) {
		throw new Error(`codewiki_task ${input.action} requires taskId.`);
	}
	if (input.action === "cancel") {
		if (!input.summary?.trim()) {
			throw new Error("codewiki_task cancel requires summary.");
		}
	}
	if (
		input.action === "update" &&
		!hasCodewikiTaskPatchChanges(input.patch) &&
		!input.evidence
	) {
		throw new Error("codewiki_task update requires patch or evidence.");
	}
	if (
		input.action === "update" &&
		input.evidence?.result &&
		["pass", "fail", "block"].includes(input.evidence.result) &&
		input.patch?.status !== undefined
	) {
		throw new Error(
			"Use evidence.result pass/fail/block without patch.status; lifecycle evidence owns the status transition.",
		);
	}
	const existingTask = await readRoadmapTask(project, input.taskId);
	if (!existingTask) throw new Error(`Roadmap task not found: ${input.taskId}`);
	let runtimeState = await maybeReadRoadmapState(project.roadmapStatePath);
	let runtimeTask = runtimeState?.tasks?.[existingTask.id] ?? null;
	let latestTask = existingTask;
	let changed = false;
	let evidenceRecorded = false;

	if (input.action === "close") {
		// Append evidence first if provided
		if (input.evidence) {
			await appendCodewikiTaskEvidence(project, existingTask, input.evidence, false);
			evidenceRecorded = true;
		}
		const closeResult = await closeCodewikiTask(
			project,
			existingTask.id,
			piTaskPorts(ctx),
			input.evidence,
			input.summary,
		);
		if (!closeResult.closed) {
			return {
				action: "close" as const,
				changed: false,
				canonical_task_ids: [existingTask.id],
				evidence_recorded: false,
				summary: `codewiki task: close ${existingTask.id} blocked — ${closeResult.reason}`,
			};
		}
		const reloaded = await readRoadmapTask(project, existingTask.id);
		if (reloaded) latestTask = reloaded;
		changed = true;
		evidenceRecorded = true;

		if (project.config.roadmap_retention?.closed_task_limit === 0) {
			const roadmapPath = resolve(project.root, project.roadmapPath);
			const archivePath = roadmapArchivePath(project);
			await withLockedPaths([roadmapPath, archivePath], async () => {
				const roadmap = await readRoadmapFile(roadmapPath);
				delete roadmap.tasks[latestTask.id];
				roadmap.order = roadmap.order.filter((id) => id !== latestTask.id);
				await writeRoadmapFile(roadmapPath, roadmap);
				await mkdir(dirname(archivePath), { recursive: true });
				await appendFile(archivePath, JSON.stringify(latestTask) + "\n", "utf8");
			});
		}
	} else if (input.action === "cancel") {
		await cancelCodewikiTask(project, existingTask.id, piTaskPorts(ctx), input.summary);
		changed = true;
		latestTask = (await readRoadmapTask(project, existingTask.id))!;
	} else {
		if (hasCodewikiTaskPatchChanges(input.patch)) {
			const patchResult = await patchCodewikiTask(project, existingTask.id, input.patch, piTaskPorts(ctx));
			latestTask = patchResult.task;
			changed = patchResult.changed;
			runtimeState = await maybeReadRoadmapState(project.roadmapStatePath);
			runtimeTask = runtimeState?.tasks?.[latestTask.id] ?? null;
		}
		if (input.evidence) {
			if (
				input.evidence.result === "pass" ||
				input.evidence.result === "fail" ||
				input.evidence.result === "block"
			) {
				await updateTaskLoop(
					project,
					{
						taskId: latestTask.id,
						action: input.evidence.result,
						phase: input.patch?.phase ?? undefined,
						summary: input.evidence.summary,
						checks_run: input.evidence.checks_run,
						files_touched: input.evidence.files_touched,
						issues: input.evidence.issues,
					},
					{ refresh: false },
				);
				evidenceRecorded = true;
				changed = true;
				const reloadedTask = await readRoadmapTask(project, latestTask.id);
				if (reloadedTask) latestTask = reloadedTask;
			} else {
				await appendTaskEvidence(project, latestTask.id, input.evidence, piTaskPorts(ctx));
				evidenceRecorded = true;
			}
		}
	}
	if (refresh && (changed || evidenceRecorded)) await runRebuild(project);
	const finalRoadmapState = await maybeReadRoadmapState(
		project.roadmapStatePath,
	);
	const finalRuntimeTask =
		finalRoadmapState?.tasks?.[latestTask.id] ?? runtimeTask;
    
	const finalContextPacket = await maybeReadTaskContext(
		project,
		latestTask.id,
		finalRuntimeTask,
	);
	const finalState = buildCodewikiTaskDetail(
		latestTask,
		finalRuntimeTask,
		finalContextPacket,
	);
	const result = {
		action: input.action,
		changed,
		canonical_task_ids: [latestTask.id],
		task: {
			id: finalState.id,
			title: finalState.title,
			status: finalState.status,
			phase: finalState.phase,
			updated: finalState.updated,
		},
		evidence_recorded: evidenceRecorded,
		summary: "",
		created: undefined,
		reused: undefined,
	};
	result.summary = summarizeCodewikiTaskAction(result);
	return result;
}
