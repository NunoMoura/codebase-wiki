import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { starterDirectories, starterFiles } from "./templates";

const execFileAsync = promisify(execFile);

export interface BootstrapOptions {
  projectName?: string;
  force?: boolean;
}

export interface BootstrapResult {
  projectName: string;
  created: string[];
  updated: string[];
  skipped: string[];
}

export default function codebaseWikiBootstrapExtension(pi: ExtensionAPI) {
  pi.registerCommand("wiki-bootstrap", {
    description: "Scaffold a starter repo-local codebase wiki into the current repository",
    getArgumentCompletions: (prefix) => {
      const options = ["--force"];
      const items = options.filter((item) => item.startsWith(prefix));
      return items.length ? items.map((value) => ({ value, label: value })) : null;
    },
    handler: async (args, ctx) => {
      try {
        const parsed = parseArgs(args, ctx.cwd);
        const result = await bootstrapCodebaseWiki(ctx.cwd, parsed);
        ctx.ui.notify(formatSummary(result), result.updated.length + result.created.length > 0 ? "success" : "info");
      } catch (error) {
        ctx.ui.notify(formatError(error), "error");
      }
    },
  });
}

export async function bootstrapCodebaseWiki(root: string, options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const projectName = (options.projectName?.trim() || basename(root)).trim();
  const date = new Date().toISOString().slice(0, 10);
  const files = starterFiles({ projectName, date });
  const result: BootstrapResult = { projectName, created: [], updated: [], skipped: [] };

  for (const relativeDir of starterDirectories()) {
    await mkdir(resolve(root, relativeDir), { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = resolve(root, relativePath);
    const exists = await pathExists(absolutePath);
    if (exists && !options.force) {
      result.skipped.push(relativePath);
      continue;
    }
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
    if (exists) result.updated.push(relativePath);
    else result.created.push(relativePath);
  }

  await runRebuild(root);
  return result;
}

async function runRebuild(root: string): Promise<void> {
  const commands = [
    ["python3", "scripts/rebuild_docs_meta.py"],
    ["python", "scripts/rebuild_docs_meta.py"],
  ];

  let lastError: unknown;
  for (const command of commands) {
    try {
      await execFileAsync(command[0], command.slice(1), { cwd: root, timeout: 120_000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Bootstrap rebuild failed: ${formatError(lastError)}`);
}

function parseArgs(args: string, cwd: string): BootstrapOptions {
  const force = /(?:^|\s)--force(?:\s|$)/.test(args);
  const cleaned = args.replace(/(?:^|\s)--force(?:\s|$)/g, " ").trim();
  return {
    force,
    projectName: cleaned || basename(cwd),
  };
}

function formatSummary(result: BootstrapResult): string {
  const parts = [
    `Bootstrapped ${result.projectName} wiki.`,
    `created=${result.created.length}`,
    `updated=${result.updated.length}`,
    `skipped=${result.skipped.length}`,
  ];
  return parts.join(" ");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

