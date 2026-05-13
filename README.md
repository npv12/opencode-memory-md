# @npv12/opencode-memory-md

Simple markdown-based memory plugin for OpenCode.

> **Attribution**: This project is a fork of [@zhafron/opencode-memory-md](https://github.com/tickernelz/opencode-memory-md). Thank you to the original author for the excellent foundation.

## Installation

Add to your OpenCode configuration at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@npv12/opencode-memory-md"]
}
```

## Memory Files

| File | Purpose |
|------|---------|
| `MEMORY.md` | Long-term memory (crucial facts, decisions, preferences) |
| `IDENTITY.md` | AI identity (name, persona, behavioral rules) |
| `USER.md` | User profile (name, preferences, context) |
| `daily/YYYY-MM-DD.md` | Daily logs (day-to-day activities) |
| `project/{folder-name}.md` | Project knowledge: features, capabilities, patterns, conventions |
| `BOOTSTRAP.md` | First run setup instructions (deleted after setup) |

### Project Memory

Project memory automatically tracks knowledge about the current project:
- **Features**: What the project does, main capabilities
- **Conventions**: Coding standards, patterns specific to this project
- **Gotchas**: Common mistakes, project-specific pitfalls
- **Decisions**: Why certain approaches were chosen

Location: `~/.config/opencode/memory/project/{current-folder-name}.md`

**Note**: Project memory is NOT automatically injected. Use `memory --action read --target project` or `memory --action search --query <keywords>` to access it.

## Storage Location

- **macOS/Linux**: `~/.config/opencode/memory/`
- **Windows**: `%APPDATA%/opencode/memory/`

## Tool: memory

**Actions:**

| Action | Description | Parameters |
|--------|-------------|------------|
| `read` | Read memory file | `target`: memory, identity, user, daily, project |
| `write` | Write to memory file | `target`, `content`, `mode`: append/overwrite |
| `edit` | Edit specific part of file (not daily) | `target`, `oldString`, `newString` |
| `search` | Search memory files | `query`, `max_results` (optional) |
| `list` | List all files | - |

**Examples:**

```bash
memory --action read --target memory
memory --action write --target memory --content "Remember to use PostgreSQL for all projects"
memory --action write --target identity --content "- **Name**: Jarvis" --mode overwrite
memory --action write --target daily --content "Fixed critical bug in auth module"
memory --action edit --target memory --oldString "Project: Auth Service" --newString "Project: Payment Service"
memory --action search --query "PostgreSQL"
memory --action list
```

## First Run Flow

**Important:** First setup must be done in OpenCode **build mode** (not plan mode). AI cannot write files in plan mode.

1. Plugin detects no MEMORY.md exists
2. Creates BOOTSTRAP.md with setup instructions
3. AI reads BOOTSTRAP.md and asks user questions interactively
4. AI writes to MEMORY.md, IDENTITY.md, USER.md
5. AI deletes BOOTSTRAP.md
6. Setup complete

## Context Injection

The following files are **automatically injected** into every system prompt:

| File | Auto-Injected | Access Method |
|------|---------------|---------------|
| `MEMORY.md` | ✅ Yes | Always available |
| `IDENTITY.md` | ✅ Yes | Always available |
| `USER.md` | ✅ Yes | Always available |
| `daily/*.md` | ❌ No | Use `memory --action read --target daily` |
| `project/*.md` | ❌ No | Use `memory --action read --target project` or `memory --action search --query <text>` |

**Why this distinction?**
- **Global files** (MEMORY, IDENTITY, USER) are small, always relevant, and needed for consistent behavior
- **Daily logs** are temporal and large - query only when needed
- **Project memory** is searchable and should be queried explicitly to keep prompts focused

## License

MIT
