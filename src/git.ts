import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { getMemoryDir } from "./config.js";

const execFileAsync = promisify(execFile);

async function runGit(memoryDir: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd: memoryDir });
  return result.stdout;
}

export async function ensureGitRepo(): Promise<void> {
  const memoryDir = getMemoryDir();
  const gitDir = path.join(memoryDir, ".git");

  if (!fs.existsSync(gitDir)) {
    try {
      await runGit(memoryDir, ["init"]);
      await runGit(memoryDir, ["config", "user.name", "OpenCode Memory"]);
      await runGit(memoryDir, ["config", "user.email", "memory@opencode.local"]);
    } catch (err) {
      console.error(
        `[git] Failed to initialize repo: ${(err as Error).message}`
      );
    }
  }
}

export async function gitCommit(operation: string): Promise<void> {
  const memoryDir = getMemoryDir();

  await ensureGitRepo();

  try {
    await runGit(memoryDir, ["add", "."]);
    const status = await runGit(memoryDir, ["status", "--porcelain"]);

    if (!status.trim()) {
      return;
    }

    await runGit(memoryDir, ["commit", "-m", operation]);
  } catch (err) {
    const errorMessage = (err as Error).message;
    if (!errorMessage.includes("nothing to commit")) {
      console.error(`[git] Commit failed: ${errorMessage}`);
    }
  }
}
