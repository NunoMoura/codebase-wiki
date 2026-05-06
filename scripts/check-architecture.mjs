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
			/from\s+["']node:/,
			/import\s+["']node:/,
			/from\s+["']\.\.\/application/,
			/from\s+["']\.\.\/infrastructure/,
			/from\s+["']\.\.\/adapters/,
			/from\s+["']\.\.\/core/,
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
			/from\s+["']\.\.\/adapters/,
			/from\s+["']\.\.\/tools/,
			/from\s+["']\.\.\/commands/,
			/from\s+["']\.\.\/ui/,
		],
	},
	{
		name: "infrastructure-does-not-use-pi",
		prefix: "infrastructure/",
		forbidden: [/@mariozechner\//, /from\s+["']\.\.\/adapters/],
	},
	{
		name: "core-does-not-use-pi-or-adapters",
		prefix: "core/",
		forbidden: [/@mariozechner\//, /from\s+["']\.\.\/adapters/],
	},
];

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
for (const file of walk(SRC_ROOT)) {
	const rel = relative(SRC_ROOT, file).replaceAll("\\", "/");
	const text = readFileSync(file, "utf8");
	for (const check of checks) {
		if (!rel.startsWith(check.prefix)) continue;
		for (const pattern of check.forbidden) {
			if (pattern.test(text)) {
				failures.push(`${check.name}: ${rel} matches ${pattern}`);
			}
		}
	}
}

if (failures.length) {
	console.error("Architecture boundary check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log("✓ architecture boundary check passed");
