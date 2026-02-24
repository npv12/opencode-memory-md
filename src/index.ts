import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { loadConfig } from "./config.js";
import { MemoryManager } from "./MemoryManager.js";
import { BootstrapManager } from "./BootstrapManager.js";

export const MemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const config = loadConfig();
  const memoryManager = new MemoryManager(config);
  const bootstrapManager = new BootstrapManager(memoryManager);

  bootstrapManager.initialize();

  const buildContext = (): string => {
    const sections: string[] = [];
    if (bootstrapManager.isBootstrapNeeded()) {
      const bootstrapContent = memoryManager.readFile(
        memoryManager.getBootstrapPath(),
      );
      if (bootstrapContent?.trim()) {
        sections.push(
          `## BOOTSTRAP.md (First Run Setup)\n\n${bootstrapContent.trim()}`,
        );
      }
    } else {
      const contextFiles = memoryManager.getContextFiles();
      for (const file of contextFiles) {
        sections.push(`## ${file.name}\n\n${file.content}`);
      }
    }
    if (sections.length === 0) return "";
    return `# Memory Context\n\n${sections.join("\n\n---\n\n")}`;
  };

  const getMemoryInstructions = (): string => {
    if (bootstrapManager.isBootstrapNeeded()) {
      return [
        "\n\n## Memory Setup",
        "This is your first run. Read BOOTSTRAP.md above and follow the setup instructions.",
        "Ask the user questions interactively, then write to MEMORY.md, IDENTITY.md, and USER.md.",
        "After setup is complete, delete BOOTSTRAP.md using the memory tool or filesystem.",
      ].join("\n");
    }
    return [
      "\n\n## Memory",
      "Memory files have been loaded above. Use the memory tool to manage them:",
      "- `memory --action write --target memory|daily` - write to MEMORY.md or daily log",
      "- `memory --action read --target memory|identity|user|daily|list` - read memory files",
      "- `memory --action search --query <text>` - search across all memory files",
      "- `memory --action list` - list all memory files",
      "\n\n## Memory Awareness - Critical Self-Check",
      "",
      "You have **persistent memory capabilities**. You MUST maintain self-awareness:",
      "",
      "### BEFORE Every Response (Silent Self-Check):",
      "1. Did I check memory files for relevant context?",
      "2. Does this query relate to past conversations in daily logs?",
      "3. Should I search memory before answering?",
      "",
      "### AFTER Every Significant Task (AUTO-UPDATE - No Permission Needed):",
      "1. Update daily log: `memory --action write --target daily` with summary",
      "2. Record new technical patterns → MEMORY.md",
      "3. Note user preferences/habits discovered → USER.md",
      "4. Reflect: What should future-me know about this session?",
      "",
      "### Memory Classification Decision Tree:",
      "```",
      "Is this information about...",
      "├─ THE USER (name, role, preference, habit, style)? → USER.md",
      "├─ MY BEHAVIOR (persona, rules, how I should act)? → IDENTITY.md",
      "├─ TECHNICAL KNOWLEDGE (stack, patterns, decisions)? → MEMORY.md",
      "└─ TASK ACTIVITY (what was done today)? → daily/YYYY-MM-DD.md",
      "```",
      "",
      "### Proactive Behavior Rules:",
      "- NEVER ask permission to update memory - just do it",
      "- NEVER put same information in multiple files (NO REDUNDANCY)",
      "- ALWAYS include timestamp context when relevant",
      "- ALWAYS use concise but specific descriptions",
      "",
      "### Auto-Reminders:",
      `- Daily log for today (${new Date().toISOString().slice(0, 10)}.md) - create if missing, update after tasks`,
      "- Memory files may be outdated - verify with user if conflicting info",
      "- After complex tasks, ask: What pattern should I remember from this?",
      "",
      "### Daily Log Format:",
      "Use structured format for better observability:",
      "```markdown",
      "## [HH:MM] TASK: {task_name}",
      "- **Action**: What was done",
      "- **Decision**: Why this approach chosen",
      "- **Memory Update**: Which files updated (if any)",
      "- **Next Steps**: Pending items or follow-ups",
      "```",
      "For simple activities, concise format is fine:",
      "- [HH:MM] Brief description",
      "",
      "### Chain-of-Thought for Memory Classification:",
      "When deciding where to store information, use this reasoning:",
      "```",
      "THOUGHT PROCESS:",
      "1. Is this about THE USER? (name, preference, habit, working style)",
      "   -> YES: USER.md",
      "2. Is this about MY BEHAVIOR? (persona, rules, how I should act)",
      "   -> YES: IDENTITY.md",
      "3. Is this TECHNICAL KNOWLEDGE? (stack, frameworks, project decisions)",
      "   -> YES: MEMORY.md",
      "4. Is this a TASK LOG? (what was done today)",
      "   -> YES: daily/YYYY-MM-DD.md",
      "",
      "Let me think step by step...",
      "[Your reasoning here]",
      "-> Final decision: [target file]",
      "```",
    ].join("\n");
  };

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const memoryContext = buildContext();
      if (!memoryContext) return;
      const instructions = getMemoryInstructions();
      output.system.push(memoryContext + instructions);
    },

    tool: {
      memory: tool({
        description: [
          "Manage memory files for persistent context across sessions.",
          "",
          "**Actions:**",
          "- `read`: Read a memory file (memory, identity, user, daily, or list all)",
          "- `write`: Write to a memory file (memory, identity, user, daily) with append or overwrite mode",
          "- `search`: Search across all memory files",
          "- `list`: List all memory files",
          "",
          "**Targets:**",
          "- `memory`: MEMORY.md - Long-term memory (crucial facts, decisions, preferences)",
          "- `identity`: IDENTITY.md - AI identity (name, persona, behavioral rules)",
          "- `user`: USER.md - User profile (name, preferences, context)",
          "- `daily`: daily/YYYY-MM-DD.md - Daily logs (day-to-day activities)",
        ].join("\n"),
        args: {
          action: tool.schema
            .enum(["read", "write", "search", "list"])
            .describe("Action to perform"),
          target: tool.schema
            .enum(["memory", "identity", "user", "daily"])
            .optional()
            .describe("Target file: memory, identity, user, or daily"),
          content: tool.schema
            .string()
            .optional()
            .describe("Content to write (for write action)"),
          mode: tool.schema
            .enum(["append", "overwrite"])
            .optional()
            .describe("Write mode (default: append)"),
          date: tool.schema
            .string()
            .optional()
            .describe("Date for daily log (YYYY-MM-DD), defaults to today"),
          query: tool.schema
            .string()
            .optional()
            .describe("Search query (for search action)"),
          max_results: tool.schema
            .number()
            .optional()
            .describe("Max search results (default: 20)"),
        },
        async execute(args) {
          memoryManager.ensureDirectories();

          switch (args.action) {
            case "read":
              return handleRead(args, memoryManager);
            case "write":
              return handleWrite(args, memoryManager);
            case "search":
              return handleSearch(args, memoryManager);
            case "list":
              return handleList(memoryManager);
            default:
              return `Unknown action: ${args.action}`;
          }
        },
      }),
    },
  };
};

function handleRead(
  params: { target?: string; date?: string },
  memoryManager: MemoryManager,
): string {
  const { target, date } = params;

  if (!target) {
    return handleList(memoryManager);
  }

  let filePath: string;
  let displayName: string;

  switch (target) {
    case "memory":
      filePath = memoryManager.getMemoryPath();
      displayName = "MEMORY.md";
      break;
    case "identity":
      filePath = memoryManager.getIdentityPath();
      displayName = "IDENTITY.md";
      break;
    case "user":
      filePath = memoryManager.getUserPath();
      displayName = "USER.md";
      break;
    case "daily": {
      const targetDate = date ?? memoryManager.todayStr();
      filePath = memoryManager.getDailyPath(targetDate);
      displayName = `daily/${targetDate}.md`;
      break;
    }
    default:
      return `Unknown target: ${target}`;
  }

  const content = memoryManager.readFile(filePath);
  if (!content) {
    return `${displayName} not found or empty.`;
  }

  return content;
}

function handleWrite(
  params: { target?: string; content?: string; mode?: string; date?: string },
  memoryManager: MemoryManager,
): string {
  const { target, content, mode, date } = params;

  if (!content) {
    return "Error: content is required for write action.";
  }

  if (!target) {
    return "Error: target is required for write action.";
  }

  let filePath: string;
  let displayName: string;

  switch (target) {
    case "memory":
      filePath = memoryManager.getMemoryPath();
      displayName = "MEMORY.md";
      break;
    case "identity":
      filePath = memoryManager.getIdentityPath();
      displayName = "IDENTITY.md";
      break;
    case "user":
      filePath = memoryManager.getUserPath();
      displayName = "USER.md";
      break;
    case "daily": {
      const targetDate = date ?? memoryManager.todayStr();
      filePath = memoryManager.getDailyPath(targetDate);
      displayName = `daily/${targetDate}.md`;
      break;
    }
    default:
      return `Unknown target: ${target}. Use 'memory', 'identity', 'user', or 'daily'.`;
  }

  if (mode === "overwrite") {
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, "");
    memoryManager.writeFile(
      filePath,
      `<!-- last updated: ${timestamp} -->\n${content}`,
    );
  } else {
    memoryManager.appendFile(filePath, content);
  }

  // ReAct-style reflection prompt for self-improvement
  const reflectionPrompt = [
    "",
    "[REFLECTION TRIGGERED]",
    "After writing to " + displayName + ", ask yourself:",
    "1. Why was this update important?",
    "2. What pattern does this reveal about the user or project?",
    "3. Should this trigger additional memory updates (cross-referencing)?",
    "4. How does this connect to previous memories?",
  ].join("\n");

  return `${mode === "overwrite" ? "Wrote to" : "Appended to"} ${displayName}.${reflectionPrompt}`;
}

function handleSearch(
  params: { query?: string; max_results?: number },
  memoryManager: MemoryManager,
): string {
  const { query, max_results } = params;

  if (!query) {
    return "Error: query is required for search action.";
  }

  const results = memoryManager.searchFiles(query, max_results ?? 20);

  if (results.length === 0) {
    return `No results for "${query}".`;
  }

  const output = results
    .map((r) => `${r.file}:${r.line}: ${r.text}`)
    .join("\n");
  return `Found ${results.length} results:\n\n${output}`;
}

function handleList(memoryManager: MemoryManager): string {
  const files = memoryManager.listFiles();
  const parts: string[] = [];

  if (files.root.length > 0) {
    parts.push(`Root files:\n${files.root.map((f) => `- ${f}`).join("\n")}`);
  }

  if (files.daily.length > 0) {
    const displayDaily = files.daily.slice(0, 10);
    const more =
      files.daily.length > 10
        ? `\n  ... and ${files.daily.length - 10} more`
        : "";
    parts.push(
      `Daily logs (${files.daily.length}):\n${displayDaily.map((f) => `- daily/${f}`).join("\n")}${more}`,
    );
  }

  if (parts.length === 0) {
    return "No memory files found.";
  }

  return parts.join("\n\n");
}

export default MemoryPlugin;
