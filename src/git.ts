import { $ } from "bun";
import * as fs from "node:fs";
import * as path from "node:path";

import { getMemoryDir } from "./config.js";

export async function ensureGitRepo(): Promise<void> {
  const memoryDir = getMemoryDir();
  const gitDir = path.join(memoryDir, ".git");

  if (!fs.existsSync(gitDir)) {
    try {
      await $`git init`.cwd(memoryDir).quiet();
      await $`git config user.name "OpenCode Memory"`.cwd(memoryDir).quiet();
      await $`git config user.email "memory@opencode.local"`
        .cwd(memoryDir)
        .quiet();
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
    await $`git add .`.cwd(memoryDir).quiet();
    const status = await $`git status --porcelain`.cwd(memoryDir).text();

    if (!status.trim()) {
      return;
    }

    await $`git commit -m ${operation}`.cwd(memoryDir).quiet();
  } catch (err) {
    const errorMessage = (err as Error).message;
    if (!errorMessage.includes("nothing to commit")) {
      console.error(`[git] Commit failed: ${errorMessage}`);
    }
  }
}
