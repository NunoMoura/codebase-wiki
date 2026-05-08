#!/usr/bin/env node
/**
 * tests/run.mjs — minimal test runner for codewiki feature tests.
 * Runs all *.test.mjs under tests/smoke/.
 */
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TESTS_DIR = resolve(import.meta.dirname, "smoke");
const files = readdirSync(TESTS_DIR)
	.filter((f) => f.endsWith(".test.mjs"))
	.sort();

if (files.length === 0) {
	console.log("No feature tests found in tests/smoke/ (only .test.mjs files are discovered).");
}

let passed = 0;
let failed = 0;
const errors = [];

for (const file of files) {
	const absPath = resolve(TESTS_DIR, file);
	try {
		console.log(`\n--- ${file} ---`);
		await import(pathToFileURL(absPath).href);
		// If no error, assume pass (tests assert internally)
		passed++;
	} catch (err) {
		failed++;
		const message = String(err?.message || err);
		errors.push(`${file}: ${message}`);
		console.error(`✗ ${file}: ${message}`);
	}
}

console.log(`\nTests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.error("Errors:");
	for (const e of errors) console.error(`  ${e}`);
	process.exit(1);
}
