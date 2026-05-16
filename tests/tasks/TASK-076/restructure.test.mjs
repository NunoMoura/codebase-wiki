import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

assert.deepEqual(packageJson.pi?.extensions, ["./src/index.ts"], "Pi extension should load from root src/index.ts");
assert.ok(packageJson.files?.includes("src"), "Package files should include root src/");
assert.ok(!packageJson.files?.includes("extensions"), "Package files should not include deprecated extensions/ wrapper");
assert.ok(!existsSync(resolve(repoRoot, "extensions", "codewiki")), "Deprecated extensions/codewiki wrapper should not exist");
assert.ok(existsSync(resolve(repoRoot, "src", "domain")), "Domain layer should exist under root src/");
assert.ok(existsSync(resolve(repoRoot, "src", "application")), "Application layer should exist under root src/");
assert.ok(existsSync(resolve(repoRoot, "src", "adapters")), "Adapters layer should exist under root src/");
assert.ok(!existsSync(resolve(repoRoot, "src", "infrastructure")), "Top-level infrastructure layer should not exist");
assert.ok(existsSync(resolve(repoRoot, "src", "application", "gateway", "index.ts")), "Gateway policy should live under application/");
assert.ok(existsSync(resolve(repoRoot, "src", "application", "graph", "rebuilder.ts")), "Graph rebuilder should live under application/");

const skillEntries = readdirSync(resolve(repoRoot, "skills"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();
assert.deepEqual(skillEntries, ["codewiki"], "Only one public CodeWiki skill should exist");
assert.ok(existsSync(resolve(repoRoot, "skills", "codewiki", "loops", "feedback.md")), "Loop docs should live under the codewiki skill");
assert.ok(existsSync(resolve(repoRoot, "skills", "codewiki", "playbooks", "research.md")), "Playbooks should live under the codewiki skill");

const appendSystem = readFileSync(resolve(repoRoot, ".pi", "APPEND_SYSTEM.md"), "utf8");
assert.match(appendSystem, /dogfood CodeWiki state/, "Project system prompt should define .codewiki dogfood boundary");
assert.match(appendSystem, /must not treat `\.codewiki\/` as package source code/, "Project system prompt should warn agents not to treat .codewiki as source");

assert.ok(existsSync(resolve(repoRoot, ".codewiki", "roadmap", "queue.json")), "Roadmap queue should live under .codewiki/roadmap/queue.json");
assert.ok(!existsSync(resolve(repoRoot, ".codewiki", "roadmap.json")), "Legacy root .codewiki/roadmap.json should not exist");
