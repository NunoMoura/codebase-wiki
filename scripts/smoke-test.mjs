#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const packageJsonPath = resolve(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const require = createRequire(import.meta.url);

function findPiRoot() {
  const fromEnv = process.env.PI_CODING_AGENT_ROOT;
  const candidates = [
    fromEnv,
    resolve(repoRoot, "node_modules", "@mariozechner", "pi-coding-agent"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && existsSync(resolve(candidate, "dist", "index.js"))) return candidate;
  }

  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    const candidate = resolve(globalRoot, "@mariozechner", "pi-coding-agent");
    if (existsSync(resolve(candidate, "dist", "index.js"))) return candidate;
  } catch {
    // Ignore and fall through to the final error.
  }

  throw new Error(
    "Unable to locate @mariozechner/pi-coding-agent. Set PI_CODING_AGENT_ROOT or install pi-coding-agent locally/globally before running the smoke tests.",
  );
}

function extendNodePath(piRoot) {
  const entries = [
    resolve(repoRoot, "node_modules"),
    resolve(piRoot, "node_modules"),
    resolve(piRoot, "..", ".."),
  ].filter(existsSync);

  const existing = process.env.NODE_PATH?.split(path.delimiter).filter(Boolean) ?? [];
  process.env.NODE_PATH = [...new Set([...entries, ...existing])].join(path.delimiter);
  require("node:module").Module._initPaths();
}

function ensurePythonYamlAvailable() {
  const commands = ["python3", "python"];
  let lastError = null;

  for (const command of commands) {
    try {
      const version = execFileSync(command, ["-c", "import yaml; print(yaml.__version__)"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      return { command, yamlVersion: version };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    "Bootstrap smoke test requires python3/python with PyYAML installed (`import yaml`). " +
      (lastError instanceof Error ? lastError.message : String(lastError)),
  );
}

function withTempDir(prefix, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  const run = async () => fn(dir);
  return run().finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

function ensureIncludes(actual, expected, label) {
  for (const item of expected) {
    assert.ok(actual.includes(item), `${label} missing ${item}. Got: ${actual.join(", ")}`);
  }
}

async function main() {
  const piRoot = findPiRoot();
  extendNodePath(piRoot);
  const python = ensurePythonYamlAvailable();

  const { DefaultResourceLoader } = await import(pathToFileURL(resolve(piRoot, "dist", "index.js")).href);

  assert.equal(packageJson.name, "codebase-wiki", "Unexpected package name");
  assert.ok(Array.isArray(packageJson.pi?.extensions) && packageJson.pi.extensions.length === 1, "Expected one Pi extension in package.json");
  assert.ok(Array.isArray(packageJson.pi?.skills) && packageJson.pi.skills.length === 1, "Expected one Pi skill path in package.json");
  assert.equal(packageJson.peerDependencies?.["@mariozechner/pi-coding-agent"], "*", "Missing pi-coding-agent peer dependency");
  assert.equal(packageJson.peerDependencies?.["@sinclair/typebox"], "*", "Missing @sinclair/typebox peer dependency");
  console.log(`✓ package manifest looks correct (${packageJson.name}@${packageJson.version})`);

  await withTempDir("codebase-wiki-loader-", async (projectDir) => {
    mkdirSync(resolve(projectDir, ".pi"), { recursive: true });
    writeFileSync(resolve(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: [repoRoot] }, null, 2));

    const loader = new DefaultResourceLoader({ cwd: projectDir });
    await loader.reload();

    const extensionResult = loader.getExtensions();
    assert.equal(extensionResult.errors.length, 0, `Unexpected extension load errors: ${extensionResult.errors.map((e) => e.message).join(" | ")}`);

    const extensions = extensionResult.extensions.filter((extension) => extension.path.startsWith(repoRoot));
    assert.equal(extensions.length, 1, `Expected exactly one package extension, found ${extensions.length}`);
    const extension = extensions[0];
    assert.equal(extension.sourceInfo.origin, "package", "Extension should load as a package resource");
    assert.equal(extension.sourceInfo.scope, "project", "Extension should load from project package settings");
    ensureIncludes([...extension.commands.keys()], [
      "wiki-bootstrap",
      "wiki-rebuild",
      "wiki-lint",
      "wiki-status",
      "wiki-self-drift",
      "wiki-code-drift",
    ], "extension commands");
    ensureIncludes([...extension.tools.keys()], [
      "codebase_wiki_bootstrap",
      "codebase_wiki_rebuild",
      "codebase_wiki_status",
    ], "extension tools");

    const skillResult = loader.getSkills();
    assert.equal(skillResult.diagnostics.length, 0, `Unexpected skill diagnostics: ${skillResult.diagnostics.map((d) => d.message).join(" | ")}`);
    const skills = skillResult.skills.filter((skill) => skill.filePath.startsWith(repoRoot));
    assert.equal(skills.length, 1, `Expected exactly one package skill, found ${skills.length}`);
    assert.equal(skills[0].name, "codebase-wiki", "Unexpected skill name");
    assert.equal(skills[0].sourceInfo.origin, "package", "Skill should load as a package resource");
  });
  console.log("✓ package loads through DefaultResourceLoader with one extension and one skill");

  await withTempDir("codebase-wiki-bootstrap-", async (projectDir) => {
    mkdirSync(resolve(projectDir, ".pi"), { recursive: true });
    writeFileSync(resolve(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: [repoRoot] }, null, 2));

    const loader = new DefaultResourceLoader({ cwd: projectDir });
    await loader.reload();
    const extension = loader.getExtensions().extensions.find((item) => item.path.startsWith(repoRoot));
    assert.ok(extension, "Expected package extension to load for bootstrap smoke test");

    const bootstrapTool = extension.tools.get("codebase_wiki_bootstrap");
    assert.ok(bootstrapTool && typeof bootstrapTool.definition?.execute === "function", "Bootstrap tool missing execute function");

    const firstResult = await bootstrapTool.definition.execute(
      "bootstrap-smoke-1",
      { projectName: "Smoke Wiki", force: false },
      undefined,
      undefined,
      { cwd: projectDir },
    );
    const secondResult = await bootstrapTool.definition.execute(
      "bootstrap-smoke-2",
      { projectName: "Smoke Wiki", force: false },
      undefined,
      undefined,
      { cwd: projectDir },
    );

    const first = firstResult.details;
    const second = secondResult.details;
    const lint = JSON.parse(readFileSync(resolve(projectDir, ".docs", "lint.json"), "utf8"));
    const registry = JSON.parse(readFileSync(resolve(projectDir, ".docs", "registry.json"), "utf8"));
    const indexText = readFileSync(resolve(projectDir, "docs", "index.md"), "utf8");

    assert.equal(first.created.length, 10, `Expected 10 created starter files, got ${first.created.length}`);
    assert.equal(first.updated.length, 0, "Initial bootstrap should not update files");
    assert.equal(second.created.length, 0, "Second bootstrap should not create files");
    assert.equal(second.updated.length, 0, "Second bootstrap should not update files without force");
    assert.equal(second.skipped.length, 10, `Expected 10 skipped starter files, got ${second.skipped.length}`);
    assert.equal(lint.issues.length, 0, `Expected zero lint issues, got ${lint.issues.length}`);
    assert.ok(Array.isArray(registry.docs) && registry.docs.length >= 6, "Expected generated registry docs");
    assert.match(indexText, /^# Smoke Wiki Docs Index/m, "Generated index title mismatch");
  });
  console.log(`✓ bootstrap smoke test passed (Python: ${python.command}, PyYAML: ${python.yamlVersion})`);

  console.log("All codebase-wiki smoke tests passed.");
}

await main();
