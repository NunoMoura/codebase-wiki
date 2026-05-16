#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const CANONICAL_ROADMAP_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"];
const LEGACY_ROADMAP_WORKFLOW_VALUES = new Set(["research", "implement", "verify"]);

const checks = [
	{
		name: "no-deprecated-pi-package-scope",
		prefix: "",
		forbidden: [/@mariozechner\//],
	},
	{
		name: "domain-is-pure",
		prefix: "domain/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["']node:/,
			/import\s+["']node:/,
			/from\s+["'](?:\.\.\/)+application/,
			/from\s+["'](?:\.\.\/)+adapters/,
			/from\s+["'](?:\.\.\/)+core/,
			/from\s+["'](?:\.\.\/)+engine/,
			/from\s+["'](?:\.\.\/)+tools/,
			/from\s+["'](?:\.\.\/)+commands/,
			/from\s+["'](?:\.\.\/)+ui/,
		],
	},
	{
		name: "application-is-agent-agnostic",
		prefix: "application/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["'](?:\.\.\/)+adapters/,
			/from\s+["'](?:\.\.\/)+tools/,
			/from\s+["'](?:\.\.\/)+commands/,
			/from\s+["'](?:\.\.\/)+ui/,
		],
	},
	{
		name: "shared-has-no-product-behavior",
		prefix: "shared/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["']node:/,
			/import\s+["']node:/,
			/from\s+["'](?:\.\.\/)+domain/,
			/from\s+["'](?:\.\.\/)+application/,
			/from\s+["'](?:\.\.\/)+adapters/,
			/from\s+["'](?:\.\.\/)+core/,
			/from\s+["'](?:\.\.\/)+engine/,
		],
	},
	{
		name: "pi-sdk-only-in-pi-adapter",
		prefix: "",
		forbiddenOutside: "adapters/pi/",
		forbidden: [/@earendil-works\/pi-/],
	},
];

// Target architecture is domain/application/adapters plus thin root entrypoints.
// `core/**`, `engine/**`, and top-level `infrastructure/**` are removed; fail if they reappear.
const transitionalFileAllowlist = new Set([]);
const piSdkEntrypointAllowlist = new Set(["index.ts", "bootstrap.ts", "mutation-queue.ts"]);

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) out.push(...walk(path));
		else if (entry.endsWith(".ts")) out.push(path);
	}
	return out;
}

function readExportedStringArray(file, exportName) {
	const text = readFileSync(file, "utf8");
	const match = text.match(new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`));
	if (!match) return null;
	return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function assertArrayEquals(name, actual, expected) {
	if (!actual) {
		failures.push(`workflow-drift: missing ${name} export`);
		return;
	}
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		failures.push(`workflow-drift: ${name} = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
	}
}

function checkRoadmapWorkflowDrift() {
	const typesPath = join(SRC_ROOT, "domain", "shared", "types.ts");
	const typesText = readFileSync(typesPath, "utf8");
	assertArrayEquals("ROADMAP_STATUS_VALUES", readExportedStringArray(typesPath, "ROADMAP_STATUS_VALUES"), CANONICAL_ROADMAP_STATUSES);
	if (/TASK_PHASE_VALUES|TaskPhase|phase\?:/.test(typesText)) {
		failures.push("workflow-drift: task phases must not be canonical types; use roadmap status plus build/validation gates");
	}

	const schemaPath = join(SRC_ROOT, "adapters", "pi", "schemas.ts");
	const schemaText = readFileSync(schemaPath, "utf8");
	if (/taskLoopPhaseSchema|phase:\s*Type\.Optional|Type\.Literal\(["']verify["']\)/.test(schemaText)) {
		failures.push("workflow-drift: Pi schema must not expose task phase fields or deprecated 'verify' literal");
	}

	const graphPath = join(ROOT, ".codewiki", "index_graph.json");
	try {
		if (/"phase"\s*:/.test(readFileSync(graphPath, "utf8"))) {
			failures.push("workflow-drift: generated index_graph.json must not expose task phase fields");
		}
	} catch {
		// Graph may not exist before bootstrap; skip.
	}

	const taskViewsDir = join(ROOT, ".codewiki", "roadmap", "tasks");
	try {
		for (const taskDir of readdirSync(taskViewsDir)) {
			const contextPath = join(taskViewsDir, taskDir, "context.json");
			try {
				if (/"phase"\s*:/.test(readFileSync(contextPath, "utf8"))) {
					failures.push(`workflow-drift: ${contextPath} must not expose task phase fields`);
				}
			} catch {
				// Task may not have a context view yet.
			}
		}
	} catch {
		// Task views may not exist before bootstrap; skip.
	}

	const queuePath = join(ROOT, ".codewiki", "roadmap", "queue.json");
	try {
		const queue = JSON.parse(readFileSync(queuePath, "utf8"));
		for (const [taskId, task] of Object.entries(queue.tasks || {})) {
			const status = String(task?.status || "").trim();
			if (LEGACY_ROADMAP_WORKFLOW_VALUES.has(status)) {
				failures.push(`workflow-drift: ${queuePath} ${taskId} uses deprecated roadmap status '${status}'`);
			}
		}
	} catch (error) {
		warnings.push(`workflow-drift: unable to read roadmap queue for status drift (${error?.message || error})`);
	}
}

const failures = [];
const warnings = [];
checkRoadmapWorkflowDrift();
for (const file of walk(SRC_ROOT)) {
	const rel = relative(SRC_ROOT, file).replaceAll("\\", "/");
	const text = readFileSync(file, "utf8");

	if (rel.startsWith("core/") || rel.startsWith("engine/") || rel.startsWith("infrastructure/")) {
		if (!transitionalFileAllowlist.has(rel)) {
			failures.push(`transitional-layer-no-new-files: ${rel} is not in the removed-layer allowlist`);
		} else {
			warnings.push(`transitional-layer-debt: ${rel}`);
		}
	}

	for (const check of checks) {
		if (!rel.startsWith(check.prefix)) continue;
		if (check.forbiddenOutside && (rel.startsWith(check.forbiddenOutside) || piSdkEntrypointAllowlist.has(rel))) continue;
		for (const pattern of check.forbidden) {
			if (pattern.test(text)) {
				failures.push(`${check.name}: ${rel} matches ${pattern}`);
			}
		}
	}
}

if (warnings.length) {
	console.warn("Architecture transition warnings:");
	for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
	console.error("Architecture boundary check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log("✓ architecture boundary check passed");
