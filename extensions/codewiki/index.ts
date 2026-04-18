import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, matchesKey, type SelectItem, SelectList, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { registerBootstrapFeatures } from "./bootstrap";
import { withLockedPaths } from "./mutation-queue";
import { findWikiRootsBelow, PREFERRED_WIKI_CONFIG_RELATIVE_PATH, requireWikiRoot, resolveWikiConfigPath } from "./project-root";

const execFileAsync = promisify(execFile);
const DEFAULT_DOCS_ROOT = "wiki";
const DEFAULT_SPECS_ROOT = "wiki/specs";
const DEFAULT_RESEARCH_ROOT = "wiki/research";
const DEFAULT_INDEX_PATH = "wiki/index.md";
const DEFAULT_ROADMAP_PATH = "wiki/roadmap.json";
const DEFAULT_ROADMAP_DOC_PATH = "wiki/roadmap.md";
const DEFAULT_ROADMAP_EVENTS_PATH = ".wiki/roadmap-events.jsonl";
const DEFAULT_META_ROOT = ".wiki";
const DEFAULT_REBUILD_SCRIPT = "scripts/rebuild_docs_meta.py";
const GENERATED_METADATA_FILES = ["registry.json", "backlinks.json", "lint.json", "roadmap-state.json", "status-state.json"] as const;
const TASK_SESSION_LINK_CUSTOM_TYPE = "codewiki.task-link";
const STATUS_DOCK_WIDGET_KEY = "codewiki-status-dock";
const STATUS_DOCK_MAX_VISIBLE_SPECS = 3;
const STATUS_DOCK_MAX_VISIBLE_TASKS = 2;
const STATUS_DOCK_PREFS_VERSION = 1;
const STATUS_DOCK_PREFS_ENV = "PI_CODEWIKI_STATUS_PREFS_PATH";
const ROADMAP_STATUS_VALUES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
const ROADMAP_PRIORITY_VALUES = ["critical", "high", "medium", "low"] as const;
const TASK_SESSION_ACTION_VALUES = ["focus", "progress", "blocked", "done", "spawn"] as const;
const STATUS_SCOPE_VALUES = ["docs", "code", "both"] as const;
const REVIEW_MODE_VALUES = ["idea", "architecture"] as const;
const STATUS_DOCK_MODE_VALUES = ["auto", "pin", "off"] as const;
const STATUS_DOCK_DENSITY_VALUES = ["minimal", "standard", "full"] as const;
const COMMAND_PREFIX = "wiki";
const CANONICAL_TASK_ID_PREFIX = "TASK";
const LEGACY_TASK_ID_PREFIX = "ROADMAP";
const TASK_ID_PATTERN = /^(TASK|ROADMAP)-(\d+)$/;

interface ScopeConfig {
  include?: string[];
  exclude?: string[];
}

interface CodeDriftScopeConfig {
  docs?: string[];
  repo_docs?: string[];
  code?: string[];
}

interface CodewikiConfig {
  name?: string;
  rebuild_command?: string[];
  self_drift_scope?: ScopeConfig;
  code_drift_scope?: CodeDriftScopeConfig;
}

interface DocsConfig {
  project_name?: string;
  docs_root?: string;
  specs_root?: string;
  research_root?: string;
  index_path?: string;
  roadmap_path?: string;
  roadmap_doc_path?: string;
  roadmap_events_path?: string;
  meta_root?: string;
  codewiki?: CodewikiConfig;
}

type RoadmapStatus = (typeof ROADMAP_STATUS_VALUES)[number];
type RoadmapPriority = (typeof ROADMAP_PRIORITY_VALUES)[number];
type TaskSessionAction = (typeof TASK_SESSION_ACTION_VALUES)[number];
type StatusScope = (typeof STATUS_SCOPE_VALUES)[number];
type ReviewMode = (typeof REVIEW_MODE_VALUES)[number];

interface LintIssue {
  severity: string;
  kind: string;
  path: string;
  message: string;
}

interface LintReport {
  generated_at: string;
  counts: Record<string, number>;
  issues: LintIssue[];
}

interface RegistryDoc {
  id?: string;
  path: string;
  title?: string;
  doc_type: string;
  state: string;
  summary?: string;
  owners?: string[];
  code_paths?: string[];
}

interface RegistryResearchCollection {
  path: string;
  entry_count: number;
}

interface RegistryRoadmapSummary {
  entry_count: number;
  counts: Record<string, number>;
}

interface RegistryFile {
  generated_at: string;
  docs: RegistryDoc[];
  research?: RegistryResearchCollection[];
  roadmap?: RegistryRoadmapSummary;
}

interface RoadmapTaskDelta {
  desired: string;
  current: string;
  closure: string;
}

interface RoadmapTaskInput {
  title: string;
  status?: RoadmapStatus;
  priority: RoadmapPriority;
  kind: string;
  summary: string;
  spec_paths?: string[];
  code_paths?: string[];
  research_ids?: string[];
  labels?: string[];
  delta?: Partial<RoadmapTaskDelta>;
}

interface RoadmapTaskUpdateInput {
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
  delta?: Partial<RoadmapTaskDelta>;
}

interface RoadmapTaskRecord {
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
  delta: RoadmapTaskDelta;
  created: string;
  updated: string;
}

interface RoadmapFile {
  version: number;
  updated: string;
  order: string[];
  tasks: Record<string, RoadmapTaskRecord>;
}

interface TaskSessionLinkInput {
  taskId: string;
  action?: TaskSessionAction;
  summary?: string;
  filesTouched?: string[];
  spawnedTaskIds?: string[];
  setSessionName?: boolean;
}

interface TaskSessionLinkRecord {
  taskId: string;
  action: TaskSessionAction;
  summary: string;
  filesTouched: string[];
  spawnedTaskIds: string[];
  timestamp: string;
}

interface RoadmapStateHealth {
  color: "green" | "yellow" | "red";
  errors: number;
  warnings: number;
  total_issues: number;
}

interface RoadmapStateSummary {
  task_count: number;
  open_count: number;
  status_counts: Record<string, number>;
  priority_counts: Record<string, number>;
}

interface RoadmapStateViews {
  ordered_task_ids: string[];
  open_task_ids: string[];
  in_progress_task_ids: string[];
  todo_task_ids: string[];
  blocked_task_ids: string[];
  done_task_ids: string[];
  cancelled_task_ids: string[];
  recent_task_ids: string[];
}

interface RoadmapStateTaskSummary {
  id: string;
  title: string;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  kind: string;
  summary: string;
  labels: string[];
  spec_paths: string[];
  code_paths: string[];
  updated: string;
}

interface RoadmapStateFile {
  version: number;
  generated_at: string;
  health: RoadmapStateHealth;
  summary: RoadmapStateSummary;
  views: RoadmapStateViews;
  tasks: Record<string, RoadmapStateTaskSummary>;
}

interface StatusStateBar {
  label: string;
  value: number;
  total: number;
  percent: number;
}

interface StatusStateSpecRow {
  path: string;
  title: string;
  summary: string;
  drift_status: "aligned" | "tracked" | "untracked" | "blocked" | "unmapped";
  code_paths: string[];
  code_area: string;
  issue_counts: { errors: number; warnings: number; total: number };
  related_task_ids: string[];
  primary_task: { id: string; status: string; title: string } | null;
  note: string;
}

interface StatusStateFile {
  version: number;
  generated_at: string;
  project: { name: string; docs_root: string; roadmap_path: string };
  health: RoadmapStateHealth;
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
  specs: StatusStateSpecRow[];
  next_step: { kind: string; command: string; reason: string };
  direction: string[];
}

type StatusDockMode = (typeof STATUS_DOCK_MODE_VALUES)[number];
type StatusDockDensity = (typeof STATUS_DOCK_DENSITY_VALUES)[number];

interface StatusDockPrefs {
  version: number;
  mode: StatusDockMode;
  density: StatusDockDensity;
  pinnedRepoPath?: string;
}

interface ResolvedStatusDockProject {
  project: WikiProject;
  statusState: StatusStateFile | null;
  source: "cwd" | "pinned";
}

interface WikiProject {
  root: string;
  label: string;
  config: DocsConfig;
  docsRoot: string;
  specsRoot: string;
  researchRoot: string;
  indexPath: string;
  roadmapPath: string;
  roadmapDocPath: string;
  metaRoot: string;
  configPath: string;
  lintPath: string;
  registryPath: string;
  eventsPath: string;
  roadmapEventsPath: string;
  roadmapStatePath: string;
  statusStatePath: string;
}

const roadmapStatusSchema = Type.Union(ROADMAP_STATUS_VALUES.map((value) => Type.Literal(value)));
const roadmapPrioritySchema = Type.Union(ROADMAP_PRIORITY_VALUES.map((value) => Type.Literal(value)));
const taskSessionActionSchema = Type.Union(TASK_SESSION_ACTION_VALUES.map((value) => Type.Literal(value)));
const roadmapTaskInputSchema = Type.Object({
  title: Type.String({ minLength: 1, description: "Short task title." }),
  status: Type.Optional(roadmapStatusSchema),
  priority: roadmapPrioritySchema,
  kind: Type.String({ minLength: 1, description: "Task kind like architecture, bug, migration, testing, docs, or agent-workflow." }),
  summary: Type.String({ minLength: 1, description: "One-sentence task summary." }),
  spec_paths: Type.Optional(Type.Array(Type.String(), { default: [] })),
  code_paths: Type.Optional(Type.Array(Type.String(), { default: [] })),
  research_ids: Type.Optional(Type.Array(Type.String(), { default: [] })),
  labels: Type.Optional(Type.Array(Type.String(), { default: [] })),
  delta: Type.Optional(Type.Object({
    desired: Type.Optional(Type.String()),
    current: Type.Optional(Type.String()),
    closure: Type.Optional(Type.String()),
  })),
});
const roadmapTaskUpdateInputSchema = Type.Object({
  taskId: Type.String({ minLength: 1, description: "Existing task id to update. Canonical ids use TASK-###; legacy ROADMAP-### is still accepted." }),
  title: Type.Optional(Type.String({ minLength: 1, description: "Updated task title." })),
  status: Type.Optional(roadmapStatusSchema),
  priority: Type.Optional(roadmapPrioritySchema),
  kind: Type.Optional(Type.String({ minLength: 1, description: "Updated task kind." })),
  summary: Type.Optional(Type.String({ minLength: 1, description: "Updated one-sentence task summary." })),
  spec_paths: Type.Optional(Type.Array(Type.String(), { description: "Replacement spec path list." })),
  code_paths: Type.Optional(Type.Array(Type.String(), { description: "Replacement code path list." })),
  research_ids: Type.Optional(Type.Array(Type.String(), { description: "Replacement research id list." })),
  labels: Type.Optional(Type.Array(Type.String(), { description: "Replacement label list." })),
  delta: Type.Optional(Type.Object({
    desired: Type.Optional(Type.String({ description: "Replacement desired-state text when provided." })),
    current: Type.Optional(Type.String({ description: "Replacement current-state text when provided." })),
    closure: Type.Optional(Type.String({ description: "Replacement closure text when provided." })),
  })),
});
const taskSessionLinkInputSchema = Type.Object({
  taskId: Type.String({ minLength: 1, description: "Existing task id to link to current Pi session. Canonical ids use TASK-###; legacy ROADMAP-### is still accepted." }),
  action: Type.Optional(taskSessionActionSchema),
  summary: Type.Optional(Type.String({ description: "Short note about what happened in this session for the task." })),
  filesTouched: Type.Optional(Type.Array(Type.String(), { default: [] })),
  spawnedTaskIds: Type.Optional(Type.Array(Type.String(), { default: [] })),
  setSessionName: Type.Optional(Type.Boolean({ description: "When true, rename the current Pi session to this canonical task id + title." })),
});
const repoPathToolField = Type.Optional(Type.String({ description: "Optional repo root, or any path inside the target repo, when the current cwd is outside that repo." }));
const roadmapAppendToolInputSchema = Type.Object({
  tasks: Type.Array(roadmapTaskInputSchema, { minItems: 1 }),
  repoPath: repoPathToolField,
});
const roadmapTaskUpdateToolInputSchema = Type.Object({
  ...roadmapTaskUpdateInputSchema.properties,
  repoPath: repoPathToolField,
});
const taskSessionLinkToolInputSchema = Type.Object({
  ...taskSessionLinkInputSchema.properties,
  repoPath: repoPathToolField,
});

export default function codewikiExtension(pi: ExtensionAPI) {
  registerBootstrapFeatures(pi);

  pi.on("turn_start", async (_event, ctx) => {
    const resolved = await resolveStatusDockProject(ctx);
    if (!resolved) {
      clearStatusDock(ctx);
      return;
    }
    await withUiErrorHandling(ctx, async () => {
      await refreshStatusDock(resolved.project, ctx, currentTaskLink(ctx), resolved);
    });
  });

  pi.on("session_start", async (_event, ctx) => {
    const resolved = await resolveStatusDockProject(ctx);
    if (!resolved) {
      ctx.ui.setStatus("codewiki-task", undefined);
      clearStatusDock(ctx);
      return;
    }

    await withUiErrorHandling(ctx, async () => {
      const active = currentTaskLink(ctx);
      if (!active) {
        ctx.ui.setStatus("codewiki-task", undefined);
        await refreshStatusDock(resolved.project, ctx, active, resolved);
        return;
      }
      const task = await readRoadmapTask(resolved.project, active.taskId);
      if (task) setTaskSessionStatus(ctx, task.id, task.title, active.action);
      await refreshStatusDock(resolved.project, ctx, active, resolved);
    });
  });

  pi.registerCommand(`${COMMAND_PREFIX}-status`, {
    description: "Inspect or configure the status dock. Usage: /wiki-status [docs|code|both] [repo-path] | /wiki-status dock auto|pin|off|minimal|standard|full [repo-path]",
    getArgumentCompletions: (prefix) => completeCommandOptions(prefix, STATUS_SCOPE_VALUES),
    handler: async (args, ctx) => {
      await withUiErrorHandling(ctx, async () => {
        const input = parseStatusCommandInput(args);
        if (input.kind === "dock") {
          const prefs = await readStatusDockPrefs();
          if (input.density) {
            const nextPrefs = { ...prefs, density: input.density };
            await writeStatusDockPrefs(nextPrefs);
            const resolved = await resolveStatusDockProject(ctx);
            if (resolved) await refreshStatusDock(resolved.project, ctx, currentTaskLink(ctx), resolved);
            else clearStatusDock(ctx);
            ctx.ui.notify(`Status dock density set to ${input.density}.`, "info");
            return;
          }
          if (input.dockMode === "off") {
            const nextPrefs = { ...prefs, mode: "off" as StatusDockMode };
            await writeStatusDockPrefs(nextPrefs);
            clearStatusDock(ctx);
            ctx.ui.notify("Status dock hidden.", "info");
            return;
          }
          if (input.dockMode === "auto") {
            const nextPrefs = { ...prefs, mode: "auto" as StatusDockMode };
            await writeStatusDockPrefs(nextPrefs);
            const resolved = await resolveStatusDockProject(ctx);
            if (resolved) await refreshStatusDock(resolved.project, ctx, currentTaskLink(ctx), resolved);
            else clearStatusDock(ctx);
            ctx.ui.notify("Status dock set to auto mode.", "info");
            return;
          }
          const project = await resolveCommandProject(ctx, input.pathArg, `${COMMAND_PREFIX}-status`);
          const nextPrefs = { ...prefs, mode: "pin" as StatusDockMode, pinnedRepoPath: project.root };
          await writeStatusDockPrefs(nextPrefs);
          await refreshStatusDock(project, ctx, currentTaskLink(ctx), { project, statusState: await maybeReadStatusState(project.statusStatePath), source: "pinned" });
          ctx.ui.notify(`Status dock pinned to ${project.root}.`, "success");
          return;
        }
        const project = await resolveCommandProject(ctx, input.pathArg, `${COMMAND_PREFIX}-status`);
        const summary = await rebuildAndSummarize(project);
        const registry = await maybeReadJson<RegistryFile>(project.registryPath);
        const roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
        const statusState = await maybeReadStatusState(project.statusStatePath);
        if (!statusState) throw new Error(`Missing status-state.json at ${project.statusStatePath}. Rebuild then retry.`);
        const text = buildStatusText(project, statusState, summary.report, input.scope, roadmapState, currentTaskLink(ctx));
        ctx.ui.notify(text, statusLevel(summary.report));
        await refreshStatusDock(project, ctx, currentTaskLink(ctx), { project, statusState, source: "cwd" });
        await queueAudit(pi, ctx, statusPrompt(project, registry, summary.report, input.scope, statusState));
      });
    },
  });

  pi.registerCommand(`${COMMAND_PREFIX}-fix`, {
    description: "Fix wiki drift in docs, code, or both. Usage: /wiki-fix [docs|code|both] [repo-path]",
    getArgumentCompletions: (prefix) => completeCommandOptions(prefix, STATUS_SCOPE_VALUES),
    handler: async (args, ctx) => {
      await withUiErrorHandling(ctx, async () => {
        const { scope, pathArg } = normalizeStatusArgs(args);
        const project = await resolveCommandProject(ctx, pathArg, `${COMMAND_PREFIX}-fix`);
        const summary = await rebuildAndSummarize(project);
        const registry = await maybeReadJson<RegistryFile>(project.registryPath);
        ctx.ui.notify(`${project.label}: queued ${scope} wiki-fix flow. Deterministic preflight is ${statusColor(summary.report)}.`, statusLevel(summary.report));
        await refreshStatusDock(project, ctx, currentTaskLink(ctx));
        await queueAudit(pi, ctx, fixPrompt(project, registry, summary.report, scope));
      });
    },
  });

  pi.registerCommand(`${COMMAND_PREFIX}-review`, {
    description: "Review project direction through idea or architecture lenses. Usage: /wiki-review [idea|architecture] [repo-path]",
    getArgumentCompletions: (prefix) => completeCommandOptions(prefix, REVIEW_MODE_VALUES),
    handler: async (args, ctx) => {
      await withUiErrorHandling(ctx, async () => {
        const { mode, pathArg } = normalizeReviewArgs(args);
        const project = await resolveCommandProject(ctx, pathArg, `${COMMAND_PREFIX}-review`);
        const summary = await rebuildAndSummarize(project);
        const registry = await maybeReadJson<RegistryFile>(project.registryPath);
        ctx.ui.notify(`${project.label}: queued ${mode} review. Deterministic preflight is ${statusColor(summary.report)}.`, statusLevel(summary.report));
        await refreshStatusDock(project, ctx, currentTaskLink(ctx));
        await queueAudit(pi, ctx, reviewPrompt(project, registry, summary.report, mode));
      });
    },
  });

  pi.registerCommand(`${COMMAND_PREFIX}-code`, {
    description: "Resume roadmap implementation from current task focus or next open task. Usage: /wiki-code [TASK-###] [repo-path]",
    handler: async (args, ctx) => {
      await withUiErrorHandling(ctx, async () => {
        const { requestedTaskId, pathArg } = normalizeCodeArgs(args);
        const project = await resolveCommandProject(ctx, pathArg, `${COMMAND_PREFIX}-code`);
        const summary = await rebuildAndSummarize(project);
        const registry = await maybeReadJson<RegistryFile>(project.registryPath);
        const roadmap = await readRoadmapFile(resolve(project.root, project.roadmapPath));
        const task = resolveImplementationTask(roadmap, currentTaskLink(ctx), requestedTaskId);
        if (!task) {
          ctx.ui.notify(`${project.label}: no open roadmap task available for /wiki-code. Run /wiki-status or /wiki-review if you need a new direction.`, "warning");
          await refreshStatusDock(project, ctx, currentTaskLink(ctx));
          return;
        }
        const action: TaskSessionAction = requestedTaskId || currentTaskLink(ctx)?.taskId !== task.id ? "focus" : "progress";
        await linkTaskSession(pi, project, ctx, {
          taskId: task.id,
          action,
          summary: action === "focus"
            ? `Focused implementation on ${task.id} through /wiki-code.`
            : `Resumed implementation on ${task.id} through /wiki-code.`,
          setSessionName: false,
        });
        const activeLink: TaskSessionLinkRecord = {
          taskId: task.id,
          action,
          summary: action === "focus"
            ? `Focused implementation on ${task.id} through /wiki-code.`
            : `Resumed implementation on ${task.id} through /wiki-code.`,
          filesTouched: [],
          spawnedTaskIds: [],
          timestamp: nowIso(),
        };
        ctx.ui.notify(`${project.label}: queued implementation for ${task.id} — ${task.title}. Deterministic preflight is ${statusColor(summary.report)}.`, statusLevel(summary.report));
        await refreshStatusDock(project, ctx, activeLink);
        await queueAudit(pi, ctx, codePrompt(project, registry, summary.report, task));
      });
    },
  });

  pi.registerTool({
    name: "codewiki_rebuild",
    label: "Codewiki Rebuild",
    description: "Rebuild the current project's codebase wiki metadata and return lint summary",
    promptSnippet: "Rebuild the current project's codebase wiki metadata and inspect deterministic lint results",
    promptGuidelines: [
      "Use this after editing wiki docs or before a semantic wiki audit when you need fresh registry and lint outputs.",
    ],
    parameters: Type.Object({
      repoPath: repoPathToolField,
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_rebuild");
      const summary = await rebuildAndSummarize(project);
      await refreshStatusDock(project, ctx, currentTaskLink(ctx));
      return {
        content: [{ type: "text", text: summary.text }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "codewiki_status",
    label: "Codewiki Status",
    description: "Show the current project's codebase wiki inventory and lint status",
    promptSnippet: "Inspect the current project's codebase wiki inventory and lint status",
    parameters: Type.Object({
      repoPath: repoPathToolField,
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_status");
      const roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
      const report = await maybeReadJson<LintReport>(project.lintPath);
      const statusState = await maybeReadStatusState(project.statusStatePath);
      const text = report && statusState
        ? buildStatusText(project, statusState, report, "both", roadmapState, currentTaskLink(ctx))
        : await readStatus(project);
      await refreshStatusDock(project, ctx, currentTaskLink(ctx));
      return {
        content: [{ type: "text", text }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "codewiki_roadmap_append",
    label: "Codewiki Roadmap Append",
    description: "Append new roadmap tasks to wiki/roadmap.json, update order, log history event, and rebuild generated roadmap/index outputs",
    promptSnippet: "Append new unresolved delta tasks to the current project's codebase wiki roadmap",
    promptGuidelines: [
      "Use this after self-drift or code-drift review when you found real unresolved delta that belongs in wiki/roadmap.json.",
      "Do not use this for issues already covered by an existing roadmap task unless you first explain why duplication is needed.",
      "The tool assigns TASK-### ids automatically, appends them to roadmap order, logs history, and rebuilds generated outputs. Legacy ROADMAP-### lookups remain accepted during migration.",
    ],
    parameters: roadmapAppendToolInputSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_roadmap_append");
      const result = await appendRoadmapTasks(pi, project, ctx, params.tasks);
      await refreshStatusDock(project, ctx, currentTaskLink(ctx));
      return {
        content: [{ type: "text", text: formatRoadmapAppendSummary(project, result.created) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "codewiki_roadmap_update",
    label: "Codewiki Roadmap Update",
    description: "Update or close an existing roadmap task in wiki/roadmap.json, log history event, and rebuild generated roadmap/index outputs",
    promptSnippet: "Update or close an existing roadmap task in the current project's codebase wiki roadmap",
    promptGuidelines: [
      "Use this when an existing roadmap task needs status, summary, paths, labels, or delta changes instead of creating a duplicate task.",
      "Set status='done' or status='cancelled' to close an existing task through the package workflow.",
      "Tool preserves task order, accepts legacy ROADMAP-### lookup during migration, logs mutation history, and rebuilds generated outputs.",
    ],
    parameters: roadmapTaskUpdateToolInputSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_roadmap_update");
      const { repoPath: _repoPath, ...updateParams } = params;
      const result = await updateRoadmapTask(project, updateParams);
      await refreshStatusDock(project, ctx, currentTaskLink(ctx));
      return {
        content: [{ type: "text", text: formatRoadmapUpdateSummary(project, result.task, result.action) }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "codewiki_task_session_link",
    label: "Codewiki Task Session Link",
    description: "Link current Pi session to an existing roadmap task, persist a Pi custom session entry, and refresh live roadmap focus without maintaining repo-owned session caches",
    promptSnippet: "Link the current Pi session to a roadmap task so future sessions can resume work cleanly",
    promptGuidelines: [
      "Use this when starting, progressing, blocking, or finishing work on an existing roadmap task.",
      "Prefer action='focus' when the session is now centered on one task.",
      "Use action='spawn' only when the current session created follow-up tasks and you need a trace from session to those tasks.",
    ],
    parameters: taskSessionLinkToolInputSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const project = await resolveToolProject(ctx.cwd, params.repoPath, "codewiki_task_session_link");
      const { repoPath: _repoPath, ...linkParams } = params;
      const result = await linkTaskSession(pi, project, ctx, linkParams);
      await refreshStatusDock(project, ctx, { taskId: result.taskId, action: result.action, summary: "", filesTouched: [], spawnedTaskIds: [], timestamp: nowIso() });
      return {
        content: [{ type: "text", text: formatTaskSessionLinkSummary(result) }],
        details: result,
      };
    },
  });
}

async function withUiErrorHandling(ctx: ExtensionContext, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    ctx.ui.notify(formatError(error), "error");
  }
}

async function queueAudit(pi: ExtensionAPI, ctx: ExtensionContext, prompt: string): Promise<void> {
  try {
    if (typeof ctx.isIdle === "function" && ctx.isIdle()) {
      pi.sendUserMessage(prompt);
    } else {
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    }
  } catch {
    // Ignore in smoke tests or non-standard execution contexts.
  }
}

function completeCommandOptions(prefix: string, options: readonly string[]): { value: string; label: string }[] | null {
  const items = options.filter((item) => item.startsWith(prefix));
  return items.length > 0 ? items.map((value) => ({ value, label: value })) : null;
}

function normalizeStatusArgs(args: string): { scope: StatusScope; pathArg: string | null } {
  const parsed = parseEnumAndPath(args, STATUS_SCOPE_VALUES, "both");
  return { scope: parsed.value as StatusScope, pathArg: parsed.pathArg };
}

function parseStatusCommandInput(args: string):
  | { kind: "inspect"; scope: StatusScope; pathArg: string | null }
  | { kind: "dock"; dockMode?: StatusDockMode; density?: StatusDockDensity; pathArg: string | null } {
  const tokens = splitCommandArgs(args);
  if (tokens[0] !== "dock") return { kind: "inspect", ...normalizeStatusArgs(args) };
  const option = tokens[1] as StatusDockMode | StatusDockDensity | undefined;
  if (!option) throw new Error("Invalid wiki-status dock usage. Use /wiki-status dock auto|pin|off|minimal|standard|full [repo-path].");
  const rest = joinCommandArgs(tokens.slice(2));
  if (STATUS_DOCK_MODE_VALUES.includes(option as StatusDockMode)) {
    return { kind: "dock", dockMode: option as StatusDockMode, pathArg: rest };
  }
  if (STATUS_DOCK_DENSITY_VALUES.includes(option as StatusDockDensity)) {
    return { kind: "dock", density: option as StatusDockDensity, pathArg: rest };
  }
  throw new Error("Invalid wiki-status dock option. Use auto, pin, off, minimal, standard, or full.");
}

function normalizeReviewArgs(args: string): { mode: ReviewMode; pathArg: string | null } {
  const parsed = parseEnumAndPath(args, REVIEW_MODE_VALUES, "architecture");
  return { mode: parsed.value as ReviewMode, pathArg: parsed.pathArg };
}

interface DriftContext {
  selfInclude: string[];
  selfExclude: string[];
  docsScope: string[];
  docsExclude: string[];
  repoDocs: string[];
  codeScope: string[];
}

function buildDriftContext(project: WikiProject, registry: RegistryFile | null): DriftContext {
  const selfScope = project.config.codewiki?.self_drift_scope ?? defaultSelfDriftScope(project);
  const selfInclude = unique(selfScope.include ?? []);
  const selfExclude = unique(selfScope.exclude ?? []);
  const docsScope = unique(project.config.codewiki?.code_drift_scope?.docs ?? defaultCodeDriftDocsScope(project));
  const docsExclude = unique(project.config.codewiki?.self_drift_scope?.exclude ?? defaultSelfDriftScope(project).exclude ?? []);
  const repoDocs = unique(project.config.codewiki?.code_drift_scope?.repo_docs ?? ["README.md"]);
  const configCode = unique(project.config.codewiki?.code_drift_scope?.code ?? []);
  const registryCode = unique(
    (registry?.docs ?? [])
      .flatMap((doc) => doc.code_paths ?? [])
      .filter(Boolean),
  );
  const codeScope = unique([...configCode, ...registryCode]);
  return { selfInclude, selfExclude, docsScope, docsExclude, repoDocs, codeScope };
}

function countIssuesBySeverity(report: LintReport, severity: string): number {
  return report.issues.filter((issue) => issue.severity === severity).length;
}

function statusColor(report: LintReport): "green" | "yellow" | "red" {
  if (countIssuesBySeverity(report, "error") > 0) return "red";
  if (report.issues.length > 0) return "yellow";
  return "green";
}

function statusLevel(report: LintReport): "success" | "warning" | "error" {
  const color = statusColor(report);
  if (color === "red") return "error";
  if (color === "yellow") return "warning";
  return "success";
}

async function maybeReadRoadmapState(path: string): Promise<RoadmapStateFile | null> {
  return maybeReadJson<RoadmapStateFile>(path);
}

async function maybeReadStatusState(path: string): Promise<StatusStateFile | null> {
  return maybeReadJson<StatusStateFile>(path);
}

function currentTaskLink(ctx: ExtensionContext | ExtensionCommandContext): TaskSessionLinkRecord | null {
  if (!hasSessionManager(ctx)) return null;
  try {
    const manager = (ctx as { sessionManager: { getBranch: () => unknown[] } }).sessionManager;
    return findLatestTaskSessionLink(manager.getBranch());
  } catch {
    return null;
  }
}

function resolveRoadmapStateTaskId(state: RoadmapStateFile, taskId: string | undefined): string | null {
  if (!taskId) return null;
  for (const candidate of taskIdCandidates(taskId)) {
    if (state.tasks[candidate]) return candidate;
  }
  return null;
}

function isOpenRoadmapTask(task: RoadmapStateTaskSummary | undefined): boolean {
  return !!task && ["todo", "in_progress", "blocked"].includes(task.status);
}

function roadmapHealthThemeColor(color: RoadmapStateHealth["color"]): "success" | "warning" | "error" {
  if (color === "red") return "error";
  if (color === "yellow") return "warning";
  return "success";
}

function roadmapWorkingSetTaskIds(state: RoadmapStateFile, activeLink: TaskSessionLinkRecord | null): string[] {
  const activeId = resolveRoadmapStateTaskId(state, activeLink?.taskId);
  const activeTask = activeId ? state.tasks[activeId] : undefined;
  return unique([
    ...(isOpenRoadmapTask(activeTask) ? [activeId as string] : []),
    ...(state.views.in_progress_task_ids ?? []),
    ...(state.views.todo_task_ids ?? []),
    ...(state.views.blocked_task_ids ?? []),
  ]).filter((taskId) => !!state.tasks[taskId]);
}

function formatRoadmapWorkingSetLine(task: RoadmapStateTaskSummary, activeId: string | null, index: number): string {
  if (task.id === activeId && isOpenRoadmapTask(task)) return `- Focused: ${task.id} — ${task.title}`;
  if (task.status === "in_progress") return `- In progress: ${task.id} — ${task.title}`;
  if (task.status === "blocked") return `- Blocked: ${task.id} — ${task.title}`;
  if (index === 0) return `- Next: ${task.id} — ${task.title}`;
  return `- Todo: ${task.id} — ${task.title}`;
}

function buildRoadmapWorkingSetLines(state: RoadmapStateFile | null, activeLink: TaskSessionLinkRecord | null, limit = 3): string[] {
  if (!state) return ["- none"];
  const activeId = resolveRoadmapStateTaskId(state, activeLink?.taskId);
  const ids = roadmapWorkingSetTaskIds(state, activeLink);
  if (ids.length === 0) {
    const doneCount = state.summary.status_counts.done ?? 0;
    return [doneCount > 0 ? `- Roadmap clear: ${doneCount} done` : "- none"];
  }
  const visible = ids.slice(0, limit).map((taskId) => state.tasks[taskId]).filter(Boolean) as RoadmapStateTaskSummary[];
  const lines = visible.map((task, index) => formatRoadmapWorkingSetLine(task, activeId, index));
  const overflow = ids.length - visible.length;
  if (overflow > 0) lines.push(`- ... and ${overflow} more open task(s)`);
  return lines;
}

function driftThemeColor(status: StatusStateSpecRow["drift_status"]): "success" | "warning" | "error" | "muted" {
  if (status === "aligned") return "success";
  if (status === "tracked") return "warning";
  if (status === "untracked") return "error";
  if (status === "blocked") return "warning";
  return "muted";
}

function driftIcon(status: StatusStateSpecRow["drift_status"]): string {
  if (status === "aligned") return "🟢";
  if (status === "tracked") return "🟡";
  if (status === "untracked") return "🔴";
  if (status === "blocked") return "⏸";
  return "⚪";
}

function barThemeColor(kind: keyof StatusStateFile["bars"], bar: StatusStateBar): "success" | "warning" | "error" {
  if (kind === "tracked_drift") {
    if (bar.total === 0 || bar.percent >= 100) return "success";
    if (bar.value === 0) return "error";
    return "warning";
  }
  if (bar.total === 0 || bar.percent >= 80) return "success";
  if (bar.percent >= 50) return "warning";
  return "error";
}

function renderProgressBar(theme: { fg: (color: string, text: string) => string }, label: string, bar: StatusStateBar, width: number, kind: keyof StatusStateFile["bars"]): string {
  const color = barThemeColor(kind, bar);
  const meterWidth = 10;
  const filled = Math.max(0, Math.min(meterWidth, Math.round((bar.percent / 100) * meterWidth)));
  const meter = `${"█".repeat(filled)}${"░".repeat(meterWidth - filled)}`;
  const line = `${label.padEnd(14)} [ ${String(bar.percent).padStart(3)}% ${meter} ] ${bar.value}/${bar.total}`;
  return truncateToWidth(theme.fg(color, line), width);
}

function resolvedNextStep(state: StatusStateFile, roadmapState: RoadmapStateFile | null, activeLink: TaskSessionLinkRecord | null): { command: string; reason: string } {
  const activeId = roadmapState ? resolveRoadmapStateTaskId(roadmapState, activeLink?.taskId) : null;
  const activeTask = activeId && roadmapState ? roadmapState.tasks[activeId] : null;
  if (activeTask && isOpenRoadmapTask(activeTask)) {
    return {
      command: `/wiki-code ${activeTask.id}`,
      reason: `Current session already focuses ${activeTask.id}.`,
    };
  }
  return state.next_step;
}

function statusDockHeaderLabel(project: WikiProject, source: "cwd" | "pinned", health: RoadmapStateHealth["color"]): string {
  const sourceLabel = source === "pinned" ? ` @ ${project.root}` : "";
  return `${project.label}${sourceLabel}`.trimEnd() + `  ${health.toUpperCase()}`;
}

function topRiskSpecs(state: StatusStateFile, limit: number): StatusStateSpecRow[] {
  return state.specs.filter((spec) => spec.drift_status !== "aligned").slice(0, limit);
}

function renderDockRiskLines(state: StatusStateFile, theme: { fg: (color: string, text: string) => string }, width: number, limit: number): string[] {
  const specs = topRiskSpecs(state, limit);
  if (specs.length === 0) return [truncateToWidth(theme.fg("success", "Risks          none"), width)];
  return specs.map((spec) => {
    const taskLabel = spec.primary_task?.id ?? "—";
    const text = `${driftIcon(spec.drift_status)} ${spec.title}  |  ${spec.code_area}  |  ${taskLabel}`;
    return truncateToWidth(theme.fg(driftThemeColor(spec.drift_status), text), width);
  });
}

function renderDockTaskLines(state: RoadmapStateFile | null, activeLink: TaskSessionLinkRecord | null, theme: { fg: (color: string, text: string) => string }, width: number, limit: number): string[] {
  const lines = buildRoadmapWorkingSetLines(state, activeLink, limit);
  return lines.map((line) => truncateToWidth(theme.fg("muted", line.replace(/^- /, "")), width));
}

function renderStatusDockLines(project: WikiProject, state: StatusStateFile, roadmapState: RoadmapStateFile | null, activeLink: TaskSessionLinkRecord | null, prefs: StatusDockPrefs, source: "cwd" | "pinned", theme: { fg: (color: string, text: string) => string; bold: (text: string) => string }, width: number): string[] {
  const color = roadmapHealthThemeColor(state.health.color);
  const nextStep = resolvedNextStep(state, roadmapState, activeLink);
  const lines = [truncateToWidth(`${theme.fg(color, "●")} ${theme.bold(theme.fg(color, statusDockHeaderLabel(project, source, state.health.color)))}`, width)];

  if (prefs.density !== "minimal") {
    lines.push(renderProgressBar(theme, "Tracked drift", state.bars.tracked_drift, width, "tracked_drift"));
    lines.push(renderProgressBar(theme, "Roadmap done", state.bars.roadmap_done, width, "roadmap_done"));
    if (prefs.density === "full") lines.push(renderProgressBar(theme, "Spec mapping", state.bars.spec_mapping, width, "spec_mapping"));
    lines.push(...renderDockRiskLines(state, theme, width, STATUS_DOCK_MAX_VISIBLE_SPECS));
    if (prefs.density === "full") lines.push(...renderDockTaskLines(roadmapState, activeLink, theme, width, STATUS_DOCK_MAX_VISIBLE_TASKS));
  }

  lines.push(truncateToWidth(theme.fg("accent", `Next           ${nextStep.command}`), width));
  if (prefs.density === "full") {
    for (const item of state.direction.slice(0, 2)) lines.push(truncateToWidth(theme.fg("muted", item), width));
  }
  return lines;
}

function clearStatusDock(ctx: ExtensionContext | ExtensionCommandContext): void {
  const ui = ctx.ui as { setWidget?: (key: string, content: undefined, options?: { placement?: "aboveEditor" | "belowEditor" }) => void };
  if (typeof ui.setWidget === "function") ui.setWidget(STATUS_DOCK_WIDGET_KEY, undefined);
}

async function refreshStatusDock(project: WikiProject, ctx: ExtensionContext | ExtensionCommandContext, activeLink: TaskSessionLinkRecord | null = currentTaskLink(ctx), resolved: ResolvedStatusDockProject | null = null): Promise<void> {
  const ui = ctx.ui as { setWidget?: (key: string, content: ((tui: any, theme: any) => { render(): string[]; invalidate(): void }) | undefined, options?: { placement?: "aboveEditor" | "belowEditor" }) => void };
  if (typeof ui.setWidget !== "function") return;
  const prefs = await readStatusDockPrefs();
  if (prefs.mode === "off") {
    ui.setWidget(STATUS_DOCK_WIDGET_KEY, undefined);
    return;
  }
  const dockState = resolved?.statusState ?? await maybeReadStatusState(project.statusStatePath);
  const roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
  if (!dockState) {
    ui.setWidget(STATUS_DOCK_WIDGET_KEY, undefined);
    return;
  }
  const source = resolved?.source ?? "cwd";
  ui.setWidget(STATUS_DOCK_WIDGET_KEY, (tui, theme) => ({
    render: () => renderStatusDockLines(project, dockState, roadmapState, activeLink, prefs, source, theme, tui?.terminal?.columns ?? 120),
    invalidate: () => {},
  }), { placement: "aboveEditor" });
}

function formatStatusSpecRow(spec: StatusStateSpecRow): string {
  const task = spec.primary_task ? `${spec.primary_task.id} ${spec.primary_task.status}` : "—";
  return `${(spec.title || spec.path).padEnd(28).slice(0, 28)} | ${`${driftIcon(spec.drift_status)} ${spec.drift_status}`.padEnd(12).slice(0, 12)} | ${spec.code_area.padEnd(24).slice(0, 24)} | ${task}`;
}

function buildStatusText(project: WikiProject, state: StatusStateFile, report: LintReport, scope: StatusScope, roadmapState: RoadmapStateFile | null = null, activeLink: TaskSessionLinkRecord | null = null): string {
  const nextStep = resolvedNextStep(state, roadmapState, activeLink);
  const lines = [
    `Wiki: ${project.label}`,
    `Root: ${project.root}`,
    `Scope: ${scope}`,
    `Health: ${state.health.color} (errors=${countIssuesBySeverity(report, "error")} warnings=${countIssuesBySeverity(report, "warning")} total=${report.issues.length})`,
    `Tracked drift: ${state.bars.tracked_drift.value}/${state.bars.tracked_drift.total} (${state.bars.tracked_drift.percent}%)`,
    `Roadmap done: ${state.bars.roadmap_done.value}/${state.bars.roadmap_done.total} (${state.bars.roadmap_done.percent}%)`,
    `Spec mapping: ${state.bars.spec_mapping.value}/${state.bars.spec_mapping.total} (${state.bars.spec_mapping.percent}%)`,
    "",
    "Spec                         | Drift        | Code area                | Task",
    ...state.specs.slice(0, 8).map((spec) => formatStatusSpecRow(spec)),
  ];
  if (state.specs.length > 8) lines.push(`... ${state.specs.length - 8} more spec row(s)`);
  lines.push("", "Roadmap working set:", ...buildRoadmapWorkingSetLines(roadmapState, activeLink), "", "Direction:", ...state.direction.map((item) => `- ${item}`), `- Next: ${nextStep.command}`, "", `Semantic ${scope} direction review queued.`);
  return lines.join("\n");
}

function defaultStatusDockPrefs(): StatusDockPrefs {
  return { version: STATUS_DOCK_PREFS_VERSION, mode: "auto", density: "standard" };
}

function resolveStatusDockPrefsPath(): string {
  const override = process.env[STATUS_DOCK_PREFS_ENV]?.trim();
  if (override) return resolve(override);
  const home = process.env.HOME?.trim();
  if (home) return resolve(home, ".pi", "agent", "codewiki-status.json");
  return resolve(".pi", "agent", "codewiki-status.json");
}

async function readStatusDockPrefs(): Promise<StatusDockPrefs> {
  const path = resolveStatusDockPrefsPath();
  if (!(await pathExists(path))) return defaultStatusDockPrefs();
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as Partial<StatusDockPrefs>;
    const mode = STATUS_DOCK_MODE_VALUES.includes(raw.mode as StatusDockMode) ? raw.mode as StatusDockMode : "auto";
    const density = STATUS_DOCK_DENSITY_VALUES.includes(raw.density as StatusDockDensity) ? raw.density as StatusDockDensity : "standard";
    const pinnedRepoPath = typeof raw.pinnedRepoPath === "string" && raw.pinnedRepoPath.trim() ? raw.pinnedRepoPath.trim() : undefined;
    return { version: STATUS_DOCK_PREFS_VERSION, mode, density, pinnedRepoPath };
  } catch {
    return defaultStatusDockPrefs();
  }
}

async function writeStatusDockPrefs(prefs: StatusDockPrefs): Promise<void> {
  const path = resolveStatusDockPrefsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ ...prefs, version: STATUS_DOCK_PREFS_VERSION }, null, 2)}\n`, "utf8");
}

async function resolveStatusDockProject(ctx: ExtensionContext | ExtensionCommandContext): Promise<ResolvedStatusDockProject | null> {
  const prefs = await readStatusDockPrefs();
  if (prefs.mode === "off") return null;
  const localProject = await maybeLoadProject(ctx.cwd);
  if (localProject) {
    return { project: localProject, statusState: await maybeReadStatusState(localProject.statusStatePath), source: "cwd" };
  }
  if (prefs.mode === "pin" && prefs.pinnedRepoPath) {
    const pinnedProject = await maybeLoadProject(prefs.pinnedRepoPath);
    if (!pinnedProject) return null;
    return { project: pinnedProject, statusState: await maybeReadStatusState(pinnedProject.statusStatePath), source: "pinned" };
  }
  return null;
}

function promptContextFiles(project: WikiProject): string[] {
  return [
    `- ${project.configPath}`,
    `- ${project.indexPath}`,
    `- ${project.roadmapPath}`,
    `- ${project.roadmapDocPath}`,
    `- ${project.registryPath.replace(`${project.root}/`, "")}`,
    `- ${project.lintPath.replace(`${project.root}/`, "")}`,
    `- ${project.roadmapStatePath.replace(`${project.root}/`, "")}`,
    `- ${project.statusStatePath.replace(`${project.root}/`, "")}`,
  ];
}

function renderSpecPromptMap(registry: RegistryFile | null): string[] {
  const specs = (registry?.docs ?? [])
    .filter((doc) => doc.doc_type === "spec")
    .sort((a, b) => a.path.localeCompare(b.path));
  if (specs.length === 0) return ["- none"];
  return specs.flatMap((spec) => {
    const codePaths = unique(spec.code_paths ?? []);
    return [`- ${spec.title ?? spec.path} | ${spec.path} | code=${codePaths.length > 0 ? codePaths.join(", ") : "none mapped"}`];
  });
}

function renderScopeForPrompt(scope: StatusScope, drift: DriftContext): string[] {
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
      ...renderList(drift.codeScope.length > 0 ? drift.codeScope : ["Use code paths referenced by live specs; no explicit code scope configured."]),
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
    ...renderList(drift.codeScope.length > 0 ? drift.codeScope : ["Use code paths referenced by live specs; no explicit code scope configured."]),
  ];
}

function statusPrompt(project: WikiProject, registry: RegistryFile | null, report: LintReport, scope: StatusScope, statusState: StatusStateFile | null = null): string {
  const drift = buildDriftContext(project, registry);
  return [
    `Review current wiki direction for ${project.label}.`,
    `Requested scope: ${scope}.`,
    `Deterministic preflight color: ${statusColor(report)}.`,
    `Deterministic lint counts: errors=${countIssuesBySeverity(report, "error")} warnings=${countIssuesBySeverity(report, "warning")} total=${report.issues.length}.`,
    ...(statusState ? [
      `Status dock snapshot: tracked=${statusState.summary.tracked_specs} untracked=${statusState.summary.untracked_specs} blocked=${statusState.summary.blocked_specs} unmapped=${statusState.summary.unmapped_specs}.`,
      `Deterministic next step: ${statusState.next_step.command}.`,
    ] : []),
    ...renderScopeForPrompt(scope, drift),
    "Context files:",
    ...promptContextFiles(project),
    "Spec map:",
    ...renderSpecPromptMap(registry),
    "Tasks:",
    "1. Infer project shape from repo evidence first.",
    "2. Validate the dock's top risky specs and whether roadmap coverage truly represents the live delta.",
    "3. Explain the next best direction for the project in concise operational language.",
    "4. Ask at most 3 high-value questions only if ambiguity materially changes the recommendation.",
    "Output format:",
    "- Overall status: green|yellow|red with confidence",
    "- Top risks: max 5 bullets tied to specs/code/roadmap",
    "- Roadmap coverage: what delta is tracked vs missing",
    "- Direction: short next-step recommendation",
    "Do not edit files yet.",
  ].join("\n");
}

function fixPrompt(project: WikiProject, registry: RegistryFile | null, report: LintReport, scope: StatusScope): string {
  const drift = buildDriftContext(project, registry);
  const scopeRule = scope === "docs"
    ? "Prefer canonical wiki/spec edits. Do not change code unless a tiny supporting fix is required."
    : scope === "code"
      ? "Prefer implementation fixes when specs are clear. If product intent or spec authority is ambiguous, ask before changing code."
      : "Choose the smallest coherent combined wiki/code fix that resolves the drift cleanly.";
  return [
    `Fix wiki drift for ${project.label}.`,
    `Requested scope: ${scope}.`,
    `Deterministic preflight color: ${statusColor(report)}.`,
    ...renderScopeForPrompt(scope, drift),
    "Context files:",
    ...promptContextFiles(project),
    "Spec map:",
    ...renderSpecPromptMap(registry),
    "Rules:",
    "- infer project shape first and use repo evidence before asking questions",
    "- ask at most 3 high-value user questions only when ambiguity materially changes the fix",
    `- ${scopeRule}`,
    "- preserve the global-package plus repo-local-data architecture",
    "- preserve roadmap as container, tasks as atomic work units, and Pi sessions as native execution history",
    "- if work maps to an existing task, use codewiki_task_session_link",
    "- if true unresolved delta remains, append a roadmap task with codewiki_roadmap_append",
    "- rebuild generated outputs before finishing",
    "- rerun deterministic status before summarizing",
    "Output format:",
    "- Changes made",
    "- Questions asked (if any)",
    "- Remaining risks or follow-ups",
    "- Recommended next command",
  ].join("\n");
}

function reviewPrompt(project: WikiProject, registry: RegistryFile | null, report: LintReport, mode: ReviewMode): string {
  const drift = buildDriftContext(project, registry);
  const modeTasks = mode === "idea"
    ? [
        "1. Review the project from business value, user need, scope coherence, and product narrative standpoints.",
        "2. Identify whether the documented intent matches a believable user and delivery need.",
        "3. Highlight scope creep, weak differentiation, or missing problem framing.",
      ]
    : [
        "1. Review the project from technical execution, ownership boundaries, architecture quality, and delivery risk standpoints.",
        "2. Identify weak seams, hidden coupling, missing invariants, or risky implementation patterns.",
        "3. Highlight where specs and code organization help or hinder execution quality.",
      ];
  return [
    `Run a senior ${mode} review for ${project.label}.`,
    `Deterministic preflight color: ${statusColor(report)}.`,
    ...renderScopeForPrompt("both", drift),
    "Context files:",
    ...promptContextFiles(project),
    "Spec map:",
    ...renderSpecPromptMap(registry),
    "Rules:",
    "- infer project shape from repo evidence first",
    "- ask at most 2 concise user questions only if a missing answer materially changes the review",
    ...modeTasks,
    "Output format:",
    "- Overall judgment",
    "- Strengths",
    "- Risks",
    "- Highest-leverage recommendations",
    "- Questions for the user only if blocking",
    "Do not edit files unless the user explicitly asks for fixes after the review.",
  ].join("\n");
}

function codePrompt(project: WikiProject, registry: RegistryFile | null, report: LintReport, task: RoadmapTaskRecord): string {
  const drift = buildDriftContext(project, registry);
  return [
    `Implement roadmap task ${task.id} for ${project.label}.`,
    `Task title: ${task.title}.`,
    `Task status: ${task.status}.`,
    `Task priority: ${task.priority}.`,
    `Task kind: ${task.kind}.`,
    `Task summary: ${task.summary}.`,
    `Deterministic preflight color: ${statusColor(report)}.`,
    ...renderScopeForPrompt("both", drift),
    "Context files:",
    ...promptContextFiles(project),
    "Spec map:",
    ...renderSpecPromptMap(registry),
    "Task delta:",
    `- Desired: ${task.delta.desired}`,
    `- Current: ${task.delta.current}`,
    `- Closure: ${task.delta.closure}`,
    ...(task.spec_paths.length > 0 ? ["Task spec paths:", ...task.spec_paths.map((path) => `- ${path}`)] : []),
    ...(task.code_paths.length > 0 ? ["Task code paths:", ...task.code_paths.map((path) => `- ${path}`)] : []),
    ...(task.research_ids.length > 0 ? ["Task research ids:", ...task.research_ids.map((researchId) => `- ${researchId}`)] : []),
    "Rules:",
    "- implement according to specs and roadmap; surface drift instead of silently choosing code over wiki",
    "- keep public UX focused on wiki-bootstrap, wiki-status, wiki-fix, wiki-review, and wiki-code",
    "- do not create a separate user-facing wiki-edit command; update roadmap/wiki artifacts automatically when user intent requires it",
    "- if intended design must change, update wiki docs and code consistently",
    "- if this task finishes or blocks, use codewiki_roadmap_update to persist status and delta changes",
    "- if follow-up delta appears that is not already tracked, use codewiki_roadmap_append",
    "- rebuild generated outputs before finishing",
    "- rerun deterministic status before summarizing",
    "Output format:",
    "- Changes made",
    "- Task status recommendation: in_progress|blocked|done",
    "- Wiki updates made automatically, if any",
    "- Remaining risks or follow-ups",
  ].join("\n");
}

async function resolveToolProject(startDir: string, repoPath: string | undefined, toolName: string): Promise<WikiProject> {
  if (repoPath) {
    const requestedPath = resolve(startDir, repoPath);
    try {
      return await loadProject(requestedPath);
    } catch (error) {
      throw new Error(`${toolName}: could not resolve repoPath ${requestedPath}. ${formatError(error)}`);
    }
  }

  try {
    return await loadProject(startDir);
  } catch {
    throw new Error(
      [
        `${toolName}: no repo-local wiki found from ${startDir}.`,
        "codewiki tools are available globally, but each run mutates one repo-local wiki.",
        `Retry with repoPath set to the target repo root, or any path inside that repo.`,
      ].join(" "),
    );
  }
}

async function resolveCommandProject(ctx: ExtensionCommandContext, pathArg: string | null, commandName: string): Promise<WikiProject> {
  if (pathArg) {
    const requestedPath = resolve(ctx.cwd, pathArg);
    try {
      return await loadProject(requestedPath);
    } catch (error) {
      throw new Error(`${commandName}: could not resolve repo path ${requestedPath}. ${formatError(error)}`);
    }
  }

  try {
    return await loadProject(ctx.cwd);
  } catch {
    const candidates = await findWikiRootsBelow(ctx.cwd);
    if (candidates.length > 0) {
      const pickedRoot = await pickCommandProjectRoot(ctx, commandName, candidates);
      if (pickedRoot) return await loadProject(pickedRoot);
    }
    throw new Error(buildGlobalCommandHelp(ctx.cwd, commandName, candidates));
  }
}

async function pickCommandProjectRoot(ctx: ExtensionCommandContext, commandName: string, roots: string[]): Promise<string | null> {
  if (!ctx.hasUI || typeof ctx.ui.custom !== "function") return null;
  const items = roots.map((root) => ({
    value: root,
    label: basename(root) || root,
    description: root,
  }));

  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));
    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(`Choose wiki project for /${commandName}`)), 1, 0));
    container.addChild(new Text(theme.fg("muted", `${items.length} candidate repo(s) found below ${ctx.cwd}`), 1, 0));

    const selectList = new SelectList(items, Math.min(Math.max(items.length, 4), 12), {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", truncateToWidth(text, Math.max((tui?.terminal?.columns ?? 100) - 8, 20))),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    selectList.onSelect = (item) => done(item.value);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);
    container.addChild(new Text(theme.fg("dim", "Type to filter • ↑↓ choose repo • Enter select • Esc cancel"), 1, 0));
    container.addChild(border);

    return {
      render: () => container.render(tui?.terminal?.columns ?? 100, 16),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

function buildGlobalCommandHelp(cwd: string, commandName: string, candidates: string[]): string {
  const lines = [
    `No repo-local wiki found from ${cwd}.`,
    "codewiki commands are loaded globally, but each run targets one repo-local wiki.",
    `Try one of these: cd into the repo, run /${commandName} /path/to/repo, or use the picker in UI mode.`,
  ];
  if (candidates.length > 0) {
    lines.push("Candidate repos below current cwd:", ...candidates.slice(0, 8).map((root) => `- ${root}`));
  } else {
    lines.push(`No ${PREFERRED_WIKI_CONFIG_RELATIVE_PATH} or .docs/config.json found below current cwd.`);
  }
  return lines.join("\n");
}

async function rebuildAndSummarize(projectOrCwd: WikiProject | string): Promise<{ text: string; issueCount: number; report: LintReport }> {
  const project = typeof projectOrCwd === "string" ? await loadProject(projectOrCwd) : projectOrCwd;
  await runRebuild(project);
  const report = await readJson<LintReport>(project.lintPath);
  const kinds = Object.entries(report.counts)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(" ");
  const issueCount = report.issues.length;
  const text = issueCount === 0
    ? `${project.label}: rebuild ok. 0 issues. Generated ${report.generated_at}`
    : `${project.label}: rebuild ok. ${issueCount} issue(s). ${kinds || ""}`.trim();
  return { text, issueCount, report };
}

async function readStatus(projectOrCwd: WikiProject | string): Promise<string> {
  const project = typeof projectOrCwd === "string" ? await loadProject(projectOrCwd) : projectOrCwd;
  const statusState = await maybeReadStatusState(project.statusStatePath);
  const report = await maybeReadJson<LintReport>(project.lintPath);
  const roadmapState = await maybeReadRoadmapState(project.roadmapStatePath);
  if (!report || !statusState) return `Wiki: ${project.label}\nRoot: ${project.root}\nGenerated metadata missing. Run /wiki-bootstrap first, then retry /wiki-status.`;
  return buildStatusText(project, statusState, report, "both", roadmapState);
}

async function browseRoadmap(project: WikiProject, roadmap: RoadmapFile, ctx: ExtensionCommandContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify(formatRoadmapSnapshot(project, roadmap), "info");
    return;
  }

  while (true) {
    const selectedTaskId = await selectRoadmapTask(project, roadmap, ctx);
    if (!selectedTaskId) return;
    const task = roadmap.tasks[selectedTaskId];
    if (!task) continue;
    await showRoadmapTask(project, roadmap, task, ctx);
  }
}

async function selectRoadmapTask(project: WikiProject, roadmap: RoadmapFile, ctx: ExtensionCommandContext): Promise<string | null> {
  const items = buildRoadmapSelectItems(roadmap);
  if (items.length === 0) {
    ctx.ui.notify(`${project.label}: no roadmap tasks found in ${project.roadmapPath}`, "warning");
    return null;
  }
  const counts = formatRoadmapCounts(roadmap);

  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(`Roadmap — ${project.label}`)), 1, 0));
    container.addChild(new Text(theme.fg("muted", `${items.length} task(s) • ${counts}`), 1, 0));

    const selectList = new SelectList(items, Math.min(Math.max(items.length, 6), 14), {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    selectList.onSelect = (item) => done(item.value);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);

    container.addChild(new Text(theme.fg("dim", "Type to filter • ↑↓ navigate • Enter inspect • Esc close"), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  }, {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "88%",
      maxHeight: "78%",
      margin: 1,
    },
  });
}

async function showRoadmapTask(project: WikiProject, roadmap: RoadmapFile, task: RoadmapTaskRecord, ctx: ExtensionCommandContext): Promise<void> {
  const text = formatRoadmapTaskText(project, roadmap, task);
  if (!ctx.hasUI) {
    ctx.ui.notify(text, "info");
    return;
  }

  await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));
    const mdTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(`${task.id} — ${task.title}`)), 1, 0));
    container.addChild(new Markdown(text, 1, 1, mdTheme));
    container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to return to the roadmap"), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "enter") || matchesKey(data, "escape")) done();
      },
    };
  }, {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "88%",
      maxHeight: "82%",
      margin: 1,
    },
  });
}

function buildRoadmapSelectItems(roadmap: RoadmapFile): SelectItem[] {
  return roadmap.order
    .map((taskId) => roadmap.tasks[taskId])
    .filter((task): task is RoadmapTaskRecord => Boolean(task))
    .map((task) => ({
      value: task.id,
      label: `${task.id} [${task.status}] ${task.title}`,
      description: `${task.priority} • ${task.kind} • ${task.summary}`,
    }));
}

function formatRoadmapCounts(roadmap: RoadmapFile): string {
  const ordered = roadmap.order
    .map((taskId) => roadmap.tasks[taskId])
    .filter((task): task is RoadmapTaskRecord => Boolean(task));
  const counts = countBy(ordered.map((task) => task.status));
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(" ") || "no tasks";
}

function normalizeRequestedTaskId(args: string): string | null {
  const trimmed = args.trim();
  return trimmed ? trimmed : null;
}

function normalizeCodeArgs(args: string): { requestedTaskId: string | null; pathArg: string | null } {
  const tokens = splitCommandArgs(args);
  if (tokens.length === 0) return { requestedTaskId: null, pathArg: null };

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (isRoadmapTaskToken(first)) {
    return { requestedTaskId: first, pathArg: joinCommandArgs(tokens.slice(1)) };
  }
  if (tokens.length > 1 && isRoadmapTaskToken(last)) {
    return { requestedTaskId: last, pathArg: joinCommandArgs(tokens.slice(0, -1)) };
  }
  return { requestedTaskId: null, pathArg: joinCommandArgs(tokens) };
}

function parseEnumAndPath<T extends string>(args: string, values: readonly T[], defaultValue: T): { value: T; pathArg: string | null } {
  const tokens = splitCommandArgs(args);
  if (tokens.length === 0) return { value: defaultValue, pathArg: null };

  const first = tokens[0] as T;
  const last = tokens[tokens.length - 1] as T;
  if ((values as readonly string[]).includes(first)) {
    return { value: first, pathArg: joinCommandArgs(tokens.slice(1)) };
  }
  if (tokens.length > 1 && (values as readonly string[]).includes(last)) {
    return { value: last, pathArg: joinCommandArgs(tokens.slice(0, -1)) };
  }
  return { value: defaultValue, pathArg: joinCommandArgs(tokens) };
}

function splitCommandArgs(args: string): string[] {
  return args.trim().split(/\s+/).filter(Boolean);
}

function joinCommandArgs(tokens: string[]): string | null {
  const value = tokens.join(" ").trim();
  return value ? value : null;
}

function isRoadmapTaskToken(value: string): boolean {
  return /^(TASK|ROADMAP)-\d+$/i.test(value);
}

function resolveImplementationTask(roadmap: RoadmapFile, activeLink: TaskSessionLinkRecord | null, requestedTaskId: string | null): RoadmapTaskRecord | null {
  if (requestedTaskId) {
    const requestedTask = resolveRoadmapTask(roadmap, requestedTaskId);
    if (!requestedTask) throw new Error(`Roadmap task not found: ${requestedTaskId}`);
    if (isClosedRoadmapStatus(requestedTask.status)) throw new Error(`Roadmap task already closed: ${requestedTask.id}`);
    return requestedTask;
  }

  const ordered = roadmap.order
    .map((taskId) => roadmap.tasks[taskId])
    .filter((task): task is RoadmapTaskRecord => Boolean(task));
  const activeTask = activeLink ? resolveRoadmapTask(roadmap, activeLink.taskId) : null;
  if (activeTask && !isClosedRoadmapStatus(activeTask.status)) return activeTask;
  const inProgressTask = ordered.find((task) => task.status === "in_progress");
  if (inProgressTask) return inProgressTask;
  const todoTask = ordered.find((task) => task.status === "todo");
  if (todoTask) return todoTask;
  return ordered.find((task) => task.status === "blocked") ?? null;
}

function formatRoadmapSnapshot(project: WikiProject, roadmap: RoadmapFile): string {
  const ordered = roadmap.order
    .map((taskId) => roadmap.tasks[taskId])
    .filter((task): task is RoadmapTaskRecord => Boolean(task));
  const lines = [
    `Roadmap: ${project.label}`,
    `Path: ${project.roadmapPath}`,
    `Tasks: ${ordered.length} (${formatRoadmapCounts(roadmap)})`,
    "",
  ];
  for (const task of ordered.slice(0, 10)) {
    lines.push(`${task.id} [${task.status}] ${task.title}`);
  }
  if (ordered.length > 10) lines.push(`... ${ordered.length - 10} more`);
  return lines.join("\n");
}

function formatRoadmapTaskText(project: WikiProject, roadmap: RoadmapFile, task: RoadmapTaskRecord): string {
  const position = roadmap.order.indexOf(task.id);
  const lines = [
    `# ${task.id} — ${task.title}`,
    "",
    `- Wiki: ${project.label}`,
    `- Status: \`${task.status}\``,
    `- Priority: \`${task.priority}\``,
    `- Kind: \`${task.kind}\``,
    `- Position: ${position >= 0 ? `${position + 1}/${roadmap.order.length}` : "untracked"}`,
  ];

  if (task.labels.length > 0) lines.push(`- Labels: ${task.labels.map((label) => `\`${label}\``).join(", ")}`);
  lines.push("", "## Summary", "", task.summary, "", "## Delta", "");
  lines.push(`- Desired: ${task.delta.desired}`);
  lines.push(`- Current: ${task.delta.current}`);
  lines.push(`- Closure: ${task.delta.closure}`);

  if (task.spec_paths.length > 0) {
    lines.push("", "## Spec paths", "", ...task.spec_paths.map((path) => `- \`${path}\``));
  }
  if (task.code_paths.length > 0) {
    lines.push("", "## Code paths", "", ...task.code_paths.map((path) => `- \`${path}\``));
  }
  if (task.research_ids.length > 0) {
    lines.push("", "## Research ids", "", ...task.research_ids.map((researchId) => `- \`${researchId}\``));
  }

  lines.push("", "## Next step", "", `Use internal task-session linking when the current Pi session is centered on ${task.id}.`);
  return lines.join("\n");
}

async function runRebuild(project: WikiProject): Promise<void> {
  return withLockedPaths(rebuildTargetPaths(project), async () => {
    await runRebuildUnlocked(project);
  });
}

async function runRebuildUnlocked(project: WikiProject): Promise<void> {
  const configuredCommand = sanitizeCommand(project.config.codewiki?.rebuild_command);
  const commands = configuredCommand
    ? uniqueCommands([configuredCommand, ...pythonAliasFallback(configuredCommand)])
    : await detectRebuildCommands(project.root);

  if (commands.length === 0) {
    throw new Error(
      `No rebuild command configured. Add codewiki.rebuild_command to ${CONFIG_RELATIVE_PATH} or provide ${DEFAULT_REBUILD_SCRIPT}.`,
    );
  }

  let lastError: unknown;
  for (const command of commands) {
    try {
      await execFileAsync(command[0], command.slice(1), { cwd: project.root, timeout: 120_000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Rebuild failed: ${formatError(lastError)}`);
}

function rebuildTargetPaths(project: WikiProject): string[] {
  return [
    resolve(project.root, project.indexPath),
    resolve(project.root, project.roadmapDocPath),
    resolve(project.root, project.eventsPath),
    ...GENERATED_METADATA_FILES.map((fileName) => resolve(project.root, project.metaRoot, fileName)),
  ];
}

function roadmapMutationTargetPaths(project: WikiProject): string[] {
  return [
    resolve(project.root, project.roadmapPath),
    resolve(project.root, project.eventsPath),
    resolve(project.root, project.roadmapEventsPath),
    ...rebuildTargetPaths(project),
  ];
}

async function detectRebuildCommands(root: string): Promise<string[][]> {
  const scriptPath = resolve(root, DEFAULT_REBUILD_SCRIPT);
  if (!(await pathExists(scriptPath))) return [];
  return [
    ["python3", DEFAULT_REBUILD_SCRIPT],
    ["python", DEFAULT_REBUILD_SCRIPT],
  ];
}

async function maybeLoadProject(startDir: string): Promise<WikiProject | null> {
  try {
    return await loadProject(startDir);
  } catch {
    return null;
  }
}

async function loadProject(startDir: string): Promise<WikiProject> {
  const root = await requireWikiRoot(startDir);
  const configPath = await resolveWikiConfigPath(root);
  if (!configPath) {
    throw new Error(`No ${PREFERRED_WIKI_CONFIG_RELATIVE_PATH} found at wiki root ${root}. Run /wiki-bootstrap first.`);
  }

  const config = await readJson<DocsConfig>(configPath);
  const docsRoot = normalizeRelativePath(config.wiki_root ?? DEFAULT_DOCS_ROOT);
  const specsRoot = normalizeRelativePath(config.specs_root ?? DEFAULT_SPECS_ROOT);
  const researchRoot = normalizeRelativePath(config.research_root ?? DEFAULT_RESEARCH_ROOT);
  const indexPath = normalizeRelativePath(config.index_path ?? DEFAULT_INDEX_PATH);
  const roadmapPath = normalizeRelativePath(config.roadmap_path ?? DEFAULT_ROADMAP_PATH);
  const roadmapDocPath = normalizeRelativePath(config.roadmap_doc_path ?? DEFAULT_ROADMAP_DOC_PATH);
  const roadmapEventsPath = normalizeRelativePath(config.roadmap_events_path ?? DEFAULT_ROADMAP_EVENTS_PATH);
  const metaRoot = normalizeRelativePath(config.meta_root ?? DEFAULT_META_ROOT);
  const label = config.codewiki?.name ?? config.project_name ?? basename(root);

  return {
    root,
    label,
    config,
    docsRoot,
    specsRoot,
    researchRoot,
    indexPath,
    roadmapPath,
    roadmapDocPath,
    metaRoot,
    configPath,
    lintPath: resolve(root, metaRoot, "lint.json"),
    registryPath: resolve(root, metaRoot, "registry.json"),
    eventsPath: resolve(root, metaRoot, "events.jsonl"),
    roadmapEventsPath,
    roadmapStatePath: resolve(root, metaRoot, "roadmap-state.json"),
    statusStatePath: resolve(root, metaRoot, "status-state.json"),
  };
}

async function appendRoadmapTasks(pi: ExtensionAPI, project: WikiProject, ctx: ExtensionContext, tasks: RoadmapTaskInput[]): Promise<{ created: RoadmapTaskRecord[] }> {
  if (tasks.length === 0) throw new Error("No roadmap tasks provided.");

  return withLockedPaths(roadmapMutationTargetPaths(project), async () => {
    const roadmapPath = resolve(project.root, project.roadmapPath);
    const roadmap = await readRoadmapFile(roadmapPath);
    const createdAt = todayIso();
    const nextId = createTaskIdAllocator(Object.keys(roadmap.tasks));
    const created = tasks.map((task) => normalizeRoadmapTask(task, nextId, createdAt));

    for (const task of created) {
      roadmap.tasks[task.id] = task;
      roadmap.order.push(task.id);
    }
    roadmap.updated = nowIso();

    await writeJsonFile(roadmapPath, roadmap);
    await appendRoadmapHistoryEvent(project, "append", created);
    await appendRoadmapEvent(project, "append", created);
    for (const task of created) {
      await recordTaskSessionLinkUnlocked(pi, ctx, task, {
        taskId: task.id,
        action: "spawn",
        summary: `Spawned task ${task.id} in current Pi session.`,
        setSessionName: false,
      });
    }
    await runRebuildUnlocked(project);
    return { created };
  });
}

async function updateRoadmapTask(project: WikiProject, input: RoadmapTaskUpdateInput): Promise<{ action: "update" | "close"; task: RoadmapTaskRecord }> {
  if (!hasRoadmapTaskUpdateFields(input)) throw new Error("No roadmap task changes provided.");

  return withLockedPaths(roadmapMutationTargetPaths(project), async () => {
    const roadmapPath = resolve(project.root, project.roadmapPath);
    const roadmap = await readRoadmapFile(roadmapPath);
    const existing = resolveRoadmapTask(roadmap, input.taskId);
    if (!existing) throw new Error(`Roadmap task not found: ${input.taskId}`);

    const updatedTask = applyRoadmapTaskUpdate(existing, input, todayIso());
    roadmap.tasks[updatedTask.id] = updatedTask;
    roadmap.updated = nowIso();

    const action = isClosedRoadmapStatus(existing.status) || !isClosedRoadmapStatus(updatedTask.status)
      ? "update"
      : "close";

    await writeJsonFile(roadmapPath, roadmap);
    await appendRoadmapHistoryEvent(project, action, [updatedTask]);
    await appendRoadmapEvent(project, action, [updatedTask]);
    await runRebuildUnlocked(project);
    return { action, task: updatedTask };
  });
}

function normalizeRoadmapTask(task: RoadmapTaskInput, nextId: () => string, today: string): RoadmapTaskRecord {
  const title = task.title.trim();
  const kind = task.kind.trim();
  const summary = task.summary.trim();
  if (!title) throw new Error("Roadmap task title is required.");
  if (!kind) throw new Error(`Roadmap task '${title}' is missing kind.`);
  if (!summary) throw new Error(`Roadmap task '${title}' is missing summary.`);

  return {
    id: nextId(),
    title,
    status: normalizeRoadmapStatus(task.status),
    priority: normalizeRoadmapPriority(task.priority),
    kind,
    summary,
    spec_paths: unique(task.spec_paths ?? []),
    code_paths: unique(task.code_paths ?? []),
    research_ids: unique(task.research_ids ?? []),
    labels: unique(task.labels ?? []),
    delta: {
      desired: task.delta?.desired?.trim() ?? "",
      current: task.delta?.current?.trim() ?? "",
      closure: task.delta?.closure?.trim() ?? "",
    },
    created: today,
    updated: today,
  };
}

function applyRoadmapTaskUpdate(task: RoadmapTaskRecord, input: RoadmapTaskUpdateInput, today: string): RoadmapTaskRecord {
  return {
    ...task,
    title: input.title === undefined ? task.title : requireNonEmptyTrimmed(input.title, `Roadmap task ${task.id} title`),
    status: input.status === undefined ? task.status : normalizeRoadmapStatus(input.status),
    priority: input.priority === undefined ? task.priority : normalizeRoadmapPriority(input.priority),
    kind: input.kind === undefined ? task.kind : requireNonEmptyTrimmed(input.kind, `Roadmap task ${task.id} kind`),
    summary: input.summary === undefined ? task.summary : requireNonEmptyTrimmed(input.summary, `Roadmap task ${task.id} summary`),
    spec_paths: input.spec_paths === undefined ? task.spec_paths : unique(input.spec_paths),
    code_paths: input.code_paths === undefined ? task.code_paths : unique(input.code_paths),
    research_ids: input.research_ids === undefined ? task.research_ids : unique(input.research_ids),
    labels: input.labels === undefined ? task.labels : unique(input.labels),
    delta: {
      desired: input.delta?.desired === undefined ? task.delta.desired : input.delta.desired.trim(),
      current: input.delta?.current === undefined ? task.delta.current : input.delta.current.trim(),
      closure: input.delta?.closure === undefined ? task.delta.closure : input.delta.closure.trim(),
    },
    updated: today,
  };
}

function hasRoadmapTaskUpdateFields(input: RoadmapTaskUpdateInput): boolean {
  return input.title !== undefined
    || input.status !== undefined
    || input.priority !== undefined
    || input.kind !== undefined
    || input.summary !== undefined
    || input.spec_paths !== undefined
    || input.code_paths !== undefined
    || input.research_ids !== undefined
    || input.labels !== undefined
    || input.delta?.desired !== undefined
    || input.delta?.current !== undefined
    || input.delta?.closure !== undefined;
}

function requireNonEmptyTrimmed(value: string, fieldLabel: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${fieldLabel} is required.`);
  return trimmed;
}

function isClosedRoadmapStatus(status: RoadmapStatus): boolean {
  return status === "done" || status === "cancelled";
}

function normalizeRoadmapStatus(status: string | undefined): RoadmapStatus {
  if (!status) return "todo";
  if ((ROADMAP_STATUS_VALUES as readonly string[]).includes(status)) return status as RoadmapStatus;
  throw new Error(`Invalid roadmap status: ${status}`);
}

function normalizeRoadmapPriority(priority: string): RoadmapPriority {
  if ((ROADMAP_PRIORITY_VALUES as readonly string[]).includes(priority)) return priority as RoadmapPriority;
  throw new Error(`Invalid roadmap priority: ${priority}`);
}

function createTaskIdAllocator(existingIds: string[]): () => string {
  let counter = existingIds
    .map((id) => parseTaskIdSequence(id))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);

  return () => {
    counter += 1;
    return formatTaskId(counter);
  };
}

function resolveRoadmapTask(roadmap: RoadmapFile, requestedId: string): RoadmapTaskRecord | null {
  for (const candidate of taskIdCandidates(requestedId)) {
    const task = roadmap.tasks[candidate];
    if (task) return task;
  }
  return null;
}

function taskIdCandidates(taskId: string): string[] {
  const trimmed = taskId.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const sequence = parseTaskIdSequence(upper);
  if (sequence === null) return unique([trimmed, upper]);
  return unique([trimmed, upper, formatTaskId(sequence), formatLegacyTaskId(sequence)]);
}

function parseTaskIdSequence(taskId: string): number | null {
  const match = TASK_ID_PATTERN.exec(taskId.trim().toUpperCase());
  if (!match) return null;
  return Number.parseInt(match[2], 10);
}

function formatTaskId(sequence: number): string {
  return `${CANONICAL_TASK_ID_PREFIX}-${String(sequence).padStart(3, "0")}`;
}

function formatLegacyTaskId(sequence: number): string {
  return `${LEGACY_TASK_ID_PREFIX}-${String(sequence).padStart(3, "0")}`;
}

async function linkTaskSession(
  pi: ExtensionAPI,
  project: WikiProject,
  ctx: ExtensionContext | ExtensionCommandContext,
  input: TaskSessionLinkInput,
): Promise<{ taskId: string; title: string; action: TaskSessionAction }> {
  const task = await readRoadmapTask(project, input.taskId);
  if (!task) throw new Error(`Roadmap task not found: ${input.taskId}`);
  await recordTaskSessionLinkUnlocked(pi, ctx, task, input);
  return { taskId: task.id, title: task.title, action: normalizeTaskSessionAction(input.action) };
}

async function recordTaskSessionLinkUnlocked(
  pi: ExtensionAPI,
  ctx: ExtensionContext | ExtensionCommandContext,
  task: RoadmapTaskRecord,
  input: TaskSessionLinkInput,
): Promise<void> {
  if (!hasSessionManager(ctx)) return;

  const link = normalizeTaskSessionLinkInput(input);
  const shouldSetSessionName = input.setSessionName ?? link.action === "focus";
  if (shouldSetSessionName) {
    try {
      pi.setSessionName(`${task.id} ${task.title}`);
    } catch {
      // Ignore in tests or non-standard execution contexts.
    }
  }
  try {
    pi.appendEntry(TASK_SESSION_LINK_CUSTOM_TYPE, {
      taskId: task.id,
      action: link.action,
      summary: link.summary,
      filesTouched: link.filesTouched,
      spawnedTaskIds: link.spawnedTaskIds,
    });
  } catch {
    // Ignore in tests or non-standard execution contexts.
  }

  setTaskSessionStatus(ctx, task.id, task.title, link.action);
}

function normalizeTaskSessionLinkInput(input: TaskSessionLinkInput): TaskSessionLinkRecord {
  return {
    taskId: input.taskId.trim(),
    action: normalizeTaskSessionAction(input.action),
    summary: input.summary?.trim() ?? "",
    filesTouched: unique(input.filesTouched ?? []),
    spawnedTaskIds: unique(input.spawnedTaskIds ?? []),
    timestamp: nowIso(),
  };
}

function normalizeTaskSessionAction(action: string | undefined): TaskSessionAction {
  if (!action) return "focus";
  if ((TASK_SESSION_ACTION_VALUES as readonly string[]).includes(action)) return action as TaskSessionAction;
  throw new Error(`Invalid task session action: ${action}`);
}

function formatTaskSessionLinkSummary(result: { taskId: string; title: string; action: TaskSessionAction }): string {
  return `Linked current Pi session to ${result.taskId} (${result.action}) — ${result.title}`;
}

async function readRoadmapTask(project: WikiProject, taskId: string): Promise<RoadmapTaskRecord | null> {
  const roadmap = await readRoadmapFile(resolve(project.root, project.roadmapPath));
  return resolveRoadmapTask(roadmap, taskId);
}

function hasSessionManager(ctx: ExtensionContext | ExtensionCommandContext): boolean {
  const manager = (ctx as { sessionManager?: { getSessionId?: () => string } }).sessionManager;
  return typeof manager?.getSessionId === "function";
}

function parseTaskSessionLinkEntry(entry: unknown): TaskSessionLinkRecord | null {
  const value = entry as {
    type?: string;
    customType?: string;
    timestamp?: string;
    data?: {
      taskId?: string;
      action?: string;
      summary?: string;
      filesTouched?: string[];
      spawnedTaskIds?: string[];
    };
  };
  if (value?.type !== "custom" || value.customType !== TASK_SESSION_LINK_CUSTOM_TYPE || !value.data?.taskId) return null;
  try {
    return {
      taskId: String(value.data.taskId),
      action: normalizeTaskSessionAction(value.data.action),
      summary: typeof value.data.summary === "string" ? value.data.summary : "",
      filesTouched: Array.isArray(value.data.filesTouched) ? unique(value.data.filesTouched) : [],
      spawnedTaskIds: Array.isArray(value.data.spawnedTaskIds) ? unique(value.data.spawnedTaskIds) : [],
      timestamp: typeof value.timestamp === "string" ? value.timestamp : nowIso(),
    };
  } catch {
    return null;
  }
}

function findLatestTaskSessionLink(entries: unknown[] | null | undefined): TaskSessionLinkRecord | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const parsed = parseTaskSessionLinkEntry(entries[index]);
    if (parsed) return parsed;
  }
  return null;
}

function setTaskSessionStatus(ctx: ExtensionContext | ExtensionCommandContext, taskId: string, title: string, action: TaskSessionAction): void {
  ctx.ui.setStatus("codewiki-task", `${taskId} ${action} — ${title}`);
}

async function appendRoadmapEvent(project: WikiProject, action: string, tasks: RoadmapTaskRecord[]): Promise<void> {
  const eventPath = resolve(project.root, project.eventsPath);
  const prefix = await jsonlAppendPrefix(eventPath);
  const titles = tasks.map((task) => `${task.id} ${task.title}`).join("; ");
  const event = JSON.stringify({
    ts: nowIso(),
    kind: `roadmap_${action}`,
    title: `${roadmapMutationVerb(action)} ${tasks.length} roadmap task(s)`,
    summary: titles,
  });
  await appendFile(eventPath, `${prefix}${event}\n`, "utf8");
}

async function appendRoadmapHistoryEvent(project: WikiProject, action: string, tasks: RoadmapTaskRecord[]): Promise<void> {
  const historyPath = resolve(project.root, project.roadmapEventsPath);
  const prefix = await jsonlAppendPrefix(historyPath);
  const lines = tasks.map((task) => JSON.stringify({
    ts: nowIso(),
    action,
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
  }));
  await appendFile(historyPath, `${prefix}${lines.join("\n")}\n`, "utf8");
}

async function jsonlAppendPrefix(path: string): Promise<string> {
  if (!(await pathExists(path))) return "";
  const raw = await readFile(path, "utf8");
  return raw.length > 0 && !raw.endsWith("\n") ? "\n" : "";
}

function formatRoadmapAppendSummary(project: WikiProject, tasks: RoadmapTaskRecord[]): string {
  return `${project.label}: appended ${tasks.length} roadmap task(s) to ${project.roadmapPath} — ${tasks.map((task) => task.id).join(", ")}`;
}

function formatRoadmapUpdateSummary(project: WikiProject, task: RoadmapTaskRecord, action: "update" | "close"): string {
  return `${project.label}: ${roadmapMutationVerb(action).toLowerCase()} roadmap task ${task.id} in ${project.roadmapPath}`;
}

function roadmapMutationVerb(action: string): string {
  if (action === "append") return "Appended";
  if (action === "close") return "Closed";
  return "Updated";
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function todayIso(): string {
  return nowIso().slice(0, 10);
}

async function readRoadmapFile(path: string): Promise<RoadmapFile> {
  if (!(await pathExists(path))) {
    return { version: 1, updated: nowIso(), order: [], tasks: {} };
  }
  const data = await readJson<RoadmapFile>(path);
  return {
    version: data.version ?? 1,
    updated: data.updated ?? nowIso(),
    order: Array.isArray(data.order) ? data.order.filter(Boolean) : [],
    tasks: typeof data.tasks === "object" && data.tasks ? data.tasks : {},
  };
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function maybeReadJson<T>(path: string): Promise<T | null> {
  if (!(await pathExists(path))) return null;
  return readJson<T>(path);
}

async function readLastEventLine(path: string): Promise<string | null> {
  if (!(await pathExists(path))) return null;
  const raw = await readFile(path, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  try {
    const event = JSON.parse(lines[lines.length - 1]) as { ts?: string; title?: string };
    return [event.ts, event.title].filter(Boolean).join(" | ") || null;
  } catch {
    return lines[lines.length - 1];
  }
}

function defaultSelfDriftScope(project: WikiProject): ScopeConfig {
  return {
    include: unique([
      project.indexPath,
      project.roadmapPath,
      project.roadmapDocPath,
      `${project.specsRoot}/**/*.md`,
      `${project.researchRoot}/**/*.jsonl`,
    ]),
    exclude: unique([`${project.wikiRoot}/_templates/**`]),
  };
}

function defaultCodeDriftDocsScope(project: WikiProject): string[] {
  return unique([project.roadmapDocPath, `${project.specsRoot}/**/*.md`]);
}

function renderScope(label: string, items: string[]): string[] {
  return [label + ":", ...renderList(items)];
}

function renderList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function sanitizeCommand(command: unknown): string[] | null {
  if (!Array.isArray(command) || command.length === 0) return null;
  const cleaned = command.filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  return cleaned.length > 0 ? cleaned : null;
}

function pythonAliasFallback(command: string[]): string[][] {
  if (command.length === 0) return [];
  if (command[0] === "python") return [["python3", ...command.slice(1)]];
  if (command[0] === "python3") return [["python", ...command.slice(1)]];
  return [];
}

function uniqueCommands(commands: string[][]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];
  for (const command of commands) {
    const key = JSON.stringify(command);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(command);
  }
  return result;
}

function normalizeRelativePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\\/g, "/");
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function formatError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    const withOutput = error as Error & { stderr?: string; stdout?: string };
    const parts = [error.message];
    const stderr = withOutput.stderr?.trim();
    const stdout = withOutput.stdout?.trim();
    if (stderr) parts.push(stderr);
    else if (stdout) parts.push(stdout);
    return parts.join("\n");
  }
  return String(error);
}
