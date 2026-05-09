#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "extensions", "codewiki", "src");

const checks = [
	{
		name: "domain-is-pure",
		prefix: "domain/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["']node:/,
			/import\s+["']node:/,
			/from\s+["']\.\.\/application/,
			/from\s+["']\.\.\/infrastructure/,
			/from\s+["']\.\.\/adapters/,
			/from\s+["']\.\.\/core/,
			/from\s+["']\.\.\/engine/,
			/from\s+["']\.\.\/tools/,
			/from\s+["']\.\.\/commands/,
			/from\s+["']\.\.\/ui/,
		],
	},
	{
		name: "application-is-agent-agnostic",
		prefix: "application/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["']\.\.\/adapters/,
			/from\s+["']\.\.\/tools/,
			/from\s+["']\.\.\/commands/,
			/from\s+["']\.\.\/ui/,
		],
	},
	{
		name: "infrastructure-does-not-use-pi-or-adapters",
		prefix: "infrastructure/",
		forbidden: [/@mariozechner\//, /@earendil-works\//, /from\s+["']\.\.\/adapters/],
	},
	{
		name: "shared-has-no-product-behavior",
		prefix: "shared/",
		forbidden: [
			/@mariozechner\//,
			/@earendil-works\//,
			/from\s+["']node:/,
			/import\s+["']node:/,
			/from\s+["']\.\.\/domain/,
			/from\s+["']\.\.\/application/,
			/from\s+["']\.\.\/infrastructure/,
			/from\s+["']\.\.\/adapters/,
			/from\s+["']\.\.\/core/,
			/from\s+["']\.\.\/engine/,
		],
	},
	{
		name: "pi-sdk-only-in-pi-adapter",
		prefix: "",
		forbiddenOutside: "adapters/pi/",
		forbidden: [/@mariozechner\//, /@earendil-works\/pi-/],
	},
];

// `core/**` and `engine/**` are transitional directories. Target v2 architecture
// is domain/application/infrastructure/shared/adapters only. Keep current files
// visible as migration debt, and fail if new files are added there.
const transitionalFileAllowlist = new Set([
	"engine/gateway.ts",
	"engine/git-cache.ts",
	"engine/graph.ts",
	"engine/lint.ts",
	"engine/parser.ts",
	"engine/rebuild.ts",
	"engine/state.ts",
	"engine/transaction.ts",
]);

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

const failures = [];
const warnings = [];
for (const file of walk(SRC_ROOT)) {
	const rel = relative(SRC_ROOT, file).replaceAll("\\", "/");
	const text = readFileSync(file, "utf8");

	if (rel.startsWith("core/") || rel.startsWith("engine/")) {
		if (!transitionalFileAllowlist.has(rel)) {
			failures.push(`transitional-layer-no-new-files: ${rel} is not in the core/engine migration allowlist`);
		} else {
			warnings.push(`transitional-layer-debt: ${rel}`);
		}
	}

	for (const check of checks) {
		if (!rel.startsWith(check.prefix)) continue;
		if (check.forbiddenOutside && rel.startsWith(check.forbiddenOutside)) continue;
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
