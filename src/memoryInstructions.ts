export const MEMORY_AWARENESS_INSTRUCTIONS = [
  "\n\n## Memory use",
  "MEMORY.md, IDENTITY.md, and USER.md are baseline context. Treat remembered facts as leads and check current code or live behavior before relying on them.",
  "Use `memory search` to find relevant daily and project knowledge. `memory read --target project` loads the project named by the current working directory when it is small enough; otherwise search it.",
  "After each task, append a detailed daily log of what you actually did: files or data changed, checks run and their results, and remaining work. For read-only investigations, record the findings. The daily log is an audit trail, not a source of permanent user preferences.",
  "Update project memory selectively for decisions, constraints, or gotchas likely to matter in later sessions and hard to rediscover from code. Update USER.md only for recurring preferences or stable user context. Keep MEMORY.md for broadly reusable, long-lived principles, not individual task corrections.",
  "When a durable fact changes, edit or replace the old statement rather than appending a contradiction. Leave periodic cross-session consolidation and stale-entry review to the dream workflow.",
  "Memory files are Git-versioned. Read a file before changing it, and preserve unrelated user edits.",
].join("\n");

export const BOOTSTRAP_INSTRUCTIONS = [
  "\n\n## Memory setup",
  "Read BOOTSTRAP.md above and ask the user for the profile, identity, and durable context it describes.",
  "Use the memory tool to save the agreed entries. Remove BOOTSTRAP.md after setup.",
].join("\n");
