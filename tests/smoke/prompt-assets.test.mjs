#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { codePrompt } from "../../src/application/prompt.ts";
import { readSkillAsset } from "../../src/application/skill-assets.ts";
import { renderOnboardingPrompt } from "../../src/bootstrap.ts";
import { normalizeCodeArgs } from "../../src/adapters/pi/commands/resume.ts";

const repoRoot = resolve(import.meta.dirname, "..", "..");
for (const asset of [
	"skills/codewiki/prompts/resume-implementation.md",
	"skills/codewiki/bootstrap/onboarding.md",
	"skills/codewiki/bootstrap/starter-taxonomy.md",
]) {
	assert.ok(existsSync(resolve(repoRoot, asset)), `missing skill asset ${asset}`);
}

const task = {
	id: "TASK-083",
	title: "Move prompt assets into skill boundary",
	status: "in_progress",
	priority: "high",
	kind: "agent-workflow",
	summary: "Prompt prose should live under skills/codewiki.",
	spec_paths: [".codewiki/kb/system/extension.md"],
	code_paths: ["skills/codewiki/prompts/resume-implementation.md", "src/application/prompt.ts"],
	research_ids: [],
	labels: ["prompts"],
	goal: {
		outcome: "Resume prompts render from skill-owned templates.",
		acceptance: ["Prompt contains selected task and artifact status context."],
		non_goals: ["Do not move runtime scheduler logic into skills."],
		verification: ["Run prompt asset smoke test."],
	},
	delta: {
		desired: "Skill owns prompt text.",
		current: "Source owns prompt text.",
		closure: "Source renders skill templates with runtime data.",
	},
};

const prompt = codePrompt(
	{
		label: "codewiki",
		root: repoRoot,
		docsRoot: ".codewiki/kb",
		roadmapPath: ".codewiki/roadmap/queue.json",
		config: { codewiki: {} },
	},
	null,
	{ counts: { error: 0, warning: 0 } },
	task,
	"Artifact status preflight:\n- Temporary session usage record: 1 in-use artifact held by this session",
	null,
	"Preserve user follow-up intent after /wiki-resume.",
);
assert.match(prompt, /Selected task:/, "resume prompt should expose selected task section");
assert.match(prompt, /TASK-083/, "resume prompt should include selected task id");
assert.match(prompt, /Temporary session usage record/, "resume prompt should include artifact/session usage context");
assert.match(prompt, /Helper-safe next steps:/, "resume prompt should include helper-safe instructions from skill asset");
assert.match(prompt, /User follow-up intent:\nPreserve user follow-up intent/, "resume prompt should preserve trailing user intent");
assert.doesNotMatch(prompt, /\{\{/, "rendered prompt should not leak unresolved template placeholders");

const onboardingPrompt = renderOnboardingPrompt({
	projectName: "SmokeProject",
	root: "/tmp/smoke-project",
	inferredProjectState: "brownfield",
	inferredBoundaries: ["src", "skills/codewiki"],
});
assert.match(onboardingPrompt, /canonical\/generated\/runtime path classes/i, "onboarding prompt should carry starter boundary guidance from skill asset");
assert.doesNotMatch(onboardingPrompt, /\{\{/, "onboarding prompt should not leak unresolved placeholders");

const taxonomy = readSkillAsset("bootstrap/starter-taxonomy.md");
assert.match(taxonomy, /Generated state\/views/, "starter taxonomy asset should define generated-view boundary");
assert.match(taxonomy, /Product\/package source/, "starter taxonomy asset should distinguish package source from .codewiki state");

assert.deepEqual(normalizeCodeArgs("TASK-083 finish with skill assets"), {
	requestedTaskId: "TASK-083",
	pathArg: null,
	followUpIntent: "finish with skill assets",
});
assert.deepEqual(normalizeCodeArgs("TASK-083 ./repo -- finish with skill assets"), {
	requestedTaskId: "TASK-083",
	pathArg: "./repo",
	followUpIntent: "finish with skill assets",
});
assert.deepEqual(normalizeCodeArgs("-- finish with current focused task"), {
	requestedTaskId: null,
	pathArg: null,
	followUpIntent: "finish with current focused task",
});

console.log("✓ prompt asset smoke passed");
