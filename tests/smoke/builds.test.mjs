/**
 * tests/smoke/builds.mjs
 *
 * Standalone smoke tests for codewiki_build (feedback, documentation, implementation)
 * and codewiki_validation. Bootstraps a fresh temp project, runs the tools, asserts.
 */
import { mkdtempSync, readFileSync, rmSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import module from "node:module";
import assert from "node:assert";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

async function run() {
	const tmp = mkdtempSync("/tmp/codewiki-build-test-");

	try {
		// Load the extension
		const piRoot = findPiRoot();
		extendNodePath(piRoot);
		const { DefaultResourceLoader, initTheme, getAgentDir } = await import(
			pathToFileURL(resolve(piRoot, "dist", "index.js")).href
		);
		initTheme("dark", false);

		const extensionPath = resolve(REPO_ROOT, "extensions", "codewiki");
		const loader = new DefaultResourceLoader({ cwd: tmp, agentDir: getAgentDir() });
		await loader.reload();

		// Find the codewiki extension
		const extResult = loader.getExtensions();
		const extensions = extResult.extensions.filter((ext) =>
			ext.path.startsWith(REPO_ROOT),
		);
		assert.equal(extensions.length, 1, "Expected one codewiki extension");
		const extension = extensions[0];

		const projectDir = tmp;
		const ctx = {
			cwd: projectDir,
			sessionManager: {
				getSessionId: () => "build-test-session",
				getSessionFile: () => resolve(projectDir, ".pi", "sessions", "build-test-session.jsonl"),
				getSessionName: () => "Build test session",
				getEntries: () => [],
				getBranch: () => [],
			},
			ui: {
				setStatus: () => {},
				setWidget: () => {},
				notify: () => {},
			},
		};

		// Bootstrap a wiki project
		const bootstrapTool = extension.tools.get("codewiki_bootstrap");
		assert.ok(bootstrapTool, "Bootstrap tool missing");
		const bootstrapResult = await bootstrapTool.definition.execute(
			"build-test-bootstrap",
			{ repoPath: projectDir, force: true },
			undefined,
			undefined,
			ctx,
		);
		assert.ok(bootstrapResult?.content, "Bootstrap failed");

		// codewiki_build: feedback
		const buildTool = extension.tools.get("codewiki_build");
		assert.ok(buildTool, "Build tool missing");

		const fbResult = await buildTool.definition.execute(
			"build-fb", { repoPath: projectDir, kind: "feedback", summary: "Smoke intent.", decisions: ["Do X."], lifecycle: { ttl_days: 7 } },
			undefined, undefined, ctx,
		);
		assert.match(fbResult.details.path, /\.codewiki\/builds\/feedback\/.*\.json$/);
		const fb = JSON.parse(readFileSync(resolve(projectDir, fbResult.details.path), "utf8"));
		assert.equal(fb.kind, "feedback_build");

		// codewiki_build: documentation
		const docResult = await buildTool.definition.execute(
			"build-doc", { repoPath: projectDir, kind: "documentation", summary: "Doc changes.", source_feedback_build: fbResult.details.path, knowledge_changes: [".codewiki/kb/system/overview.md"], lifecycle: { ttl_days: 14 } },
			undefined, undefined, ctx,
		);
		assert.match(docResult.details.path, /\.codewiki\/builds\/documentation\/.*\.json$/);
		const doc = JSON.parse(readFileSync(resolve(projectDir, docResult.details.path), "utf8"));
		assert.equal(doc.kind, "documentation_build");

		// codewiki_build: implementation
		const implResult = await buildTool.definition.execute(
			"build-impl", { repoPath: projectDir, kind: "implementation", summary: "Impl done.", task_id: "TASK-001", test_files: ["test.js"], code_files: ["src/index.ts"], checks_run: ["npm test"], acceptance_mapping: [{ criterion: "Works", evidence: "Pass" }], lifecycle: { ttl_days: 7 } },
			undefined, undefined, ctx,
		);
		assert.match(implResult.details.path, /\.codewiki\/builds\/implementation\/.*\.json$/);
		const impl = JSON.parse(readFileSync(resolve(projectDir, implResult.details.path), "utf8"));
		assert.equal(impl.kind, "implementation_build");

		// codewiki_validation: pass
		const valTool = extension.tools.get("codewiki_validation");
		assert.ok(valTool, "Validation tool missing");
		const passResult = await valTool.definition.execute(
			"val-pass", { repoPath: projectDir, profile: "task-close", verdict: "pass", rationale: "All good." },
			undefined, undefined, ctx,
		);
		assert.match(passResult.details.path, /\.codewiki\/validation\/.*task-close-pass.*\.json$/);

		// codewiki_validation: fail
		const failResult = await valTool.definition.execute(
			"val-fail", { repoPath: projectDir, profile: "documentation", verdict: "fail", rationale: "Bad.", issues: [{ severity: "high", summary: "Missing spec." }] },
			undefined, undefined, ctx,
		);
		assert.match(failResult.details.path, /\.codewiki\/validation\/.*documentation-fail.*\.json$/);

		// codewiki_validation: block
		const blockResult = await valTool.definition.execute(
			"val-block", { repoPath: projectDir, profile: "implementation", verdict: "block", rationale: "Unsure.", issues: [{ severity: "high", summary: "Ambiguous intent." }] },
			undefined, undefined, ctx,
		);
		assert.match(blockResult.details.path, /\.codewiki\/validation\/.*implementation-block.*\.json$/);

		// Graph reconciliation coverage
		const stateTool = extension.tools.get("codewiki_state");
		assert.ok(stateTool, "State tool missing");
		const stateResult = await stateTool.definition.execute(
			"state-graph", { repoPath: projectDir, include: ["graph"], refresh: true },
			undefined, undefined, ctx,
		);
		const rec = stateResult.details?.graph?.reconciliation;
		assert.ok(rec, "Graph reconciliation view missing");
		assert.equal(rec.controller, "reconciliation_gateway");
		assert.ok(rec.counts_by_loop?.feedback >= 0, "Reconciliation counts missing");

		// Validation reconciliation items
		const graph = JSON.parse(readFileSync(resolve(projectDir, ".codewiki", "index_graph.json"), "utf8"));
		const items = graph.views?.reconciliation?.items || [];
		assert.ok(items.some(i => i.source_id === `build:${fbResult.details.path}` && i.next_loop === "documentation"), "Feedback build not in reconciliation");
		assert.ok(items.some(i => i.source_id === `build:${docResult.details.path}` && i.next_loop === "documentation"), "Doc build not in reconciliation");
		assert.ok(items.some(i => i.source_id === `build:${implResult.details.path}` && i.next_loop === "implementation"), "Impl build not in reconciliation");
		assert.ok(items.some(i => i.source_id === `validation:${failResult.details.path}` && i.next_loop === "documentation"), "Fail validation not routing to documentation");

		console.log("✓ build and validation smoke tests passed");
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

// ---- helpers (minimal copies from smoke-test.mjs) ----
function findPiRoot() {
	const candidates = [
		resolve(import.meta.dirname, "..", "..", "node_modules", "@earendil-works", "pi-coding-agent"),
		resolve(import.meta.dirname, "..", "..", "..", "@earendil-works", "pi-coding-agent"),
	];
	for (const c of candidates) {
		try { if (readFileSync(resolve(c, "dist", "index.js"))) return c; } catch {}
	}
	try {
		const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
		const candidate = resolve(globalRoot, "@earendil-works", "pi-coding-agent");
		try { if (readFileSync(resolve(candidate, "dist", "index.js"))) return candidate; } catch {}
	} catch {}
	throw new Error("Cannot find pi-coding-agent");
}

function extendNodePath(piRoot) {
	const extras = resolve(piRoot, "node_modules");
	try {
		if (statSync(extras).isDirectory()) {
			for (const name of readdirSync(extras)) {
				if (name.startsWith("@")) {
					const scope = resolve(extras, name);
					for (const child of readdirSync(scope)) {
						process.env.NODE_PATH = `${process.env.NODE_PATH || ""}:${resolve(scope, child)}`;
					}
				} else {
					process.env.NODE_PATH = `${process.env.NODE_PATH || ""}:${resolve(extras, name)}`;
				}
			}
		}
	} catch {}
	module.Module._initPaths();
}

run().catch((err) => {
	console.error("✗ build and validation smoke tests failed");
	console.error(String(err?.stack || err));
	process.exit(1);
});