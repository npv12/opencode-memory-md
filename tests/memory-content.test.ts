import { expect, test } from "bun:test";

import { chunkMarkdown } from "../src/chunker.js";
import { removeTimestampEntries } from "../src/timestampParser.js";

test("chunks heading bodies without losing the document introduction", () => {
  const chunks = chunkMarkdown(
    "# Memory\nIntroduction\n## Project\nPostgres constraints\n### Tests\nRun just test",
    "/memory/project/example.md"
  );

  expect(chunks.map(({ heading, text }) => ({ heading, text }))).toEqual([
    { heading: "", text: "# Memory\nIntroduction" },
    { heading: "Project", text: "Project\nPostgres constraints" },
    { heading: "Tests", text: "Tests\nRun just test" },
  ]);
});

test("indexes heading-free content and drops old title-only chunks", () => {
  const filePath = "/memory/project/example.md";
  expect(chunkMarkdown("Plain note", filePath)[0].text).toBe("Plain note");
  expect(
    chunkMarkdown("## Project\nPostgres constraints", filePath)[0].hash
  ).not.toBe(chunkMarkdown("## Project\nOther constraints", filePath)[0].hash);
});

test("bounds long sections without mixing timestamped entries", () => {
  const first = "First fact ".repeat(110).trim();
  const second = "Second fact ".repeat(110).trim();
  const content = `# Daily log\n\n<!-- 2026-09-21 10:00:00 -->\n## Investigation\n${first}\n\n${second}\n\n<!-- 2026-09-21 11:00:00 -->\n## Follow-up\nDecided to ship`;
  const chunks = chunkMarkdown(content, "/memory/daily/2026-09-21.md");

  expect(chunks[0].timestamp).toBeUndefined();
  expect(
    chunks.filter((chunk) => chunk.timestamp === "2026-09-21 10:00:00").length
  ).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.text.length <= 1200)).toBe(true);
  expect(
    chunks.every(
      (chunk) =>
        !chunk.text.includes("First fact") ||
        !chunk.text.includes("Decided to ship")
    )
  ).toBe(true);
  expect(chunks.at(-1)).toMatchObject({
    heading: "Follow-up",
    text: "Follow-up\nDecided to ship",
    timestamp: "2026-09-21 11:00:00",
  });
});

test("splits an oversized paragraph and keeps untimestamped project chunks", () => {
  const chunks = chunkMarkdown(
    `## Architecture\n${"x".repeat(2500)}`,
    "/memory/project/example.md"
  );

  expect(chunks.length).toBe(3);
  expect(
    chunks.every(
      (chunk) =>
        chunk.heading === "Architecture" &&
        !chunk.timestamp &&
        chunk.text.length <= 1200
    )
  ).toBe(true);
  expect(
    chunks.map((chunk) => chunk.text.slice("Architecture\n".length)).join("")
  ).toBe("x".repeat(2500));
});

test("keeps lines together when a long paragraph has a nearby line break", () => {
  const firstLine = "First line ".repeat(108).trim();
  const chunks = chunkMarkdown(
    `## Notes\n${firstLine}\nSecond line with a separate fact`,
    "/memory/project/example.md"
  );

  expect(chunks.map((chunk) => chunk.text)).toEqual([
    `Notes\n${firstLine}`,
    "Notes\nSecond line with a separate fact",
  ]);
});

test("identical notes on different dates retain separate identities", () => {
  const chunks = chunkMarkdown(
    "<!-- 2026-09-21 10:00:00 -->\n## Note\nSame fact\n\n<!-- 2026-09-22 10:00:00 -->\n## Note\nSame fact",
    "/memory/daily/notes.md"
  );

  expect(chunks.map((chunk) => chunk.timestamp)).toEqual([
    "2026-09-21 10:00:00",
    "2026-09-22 10:00:00",
  ]);
  expect(chunks[0].hash).not.toBe(chunks[1].hash);
});

test("timestamp deletion keeps unmarked material and other entries intact", () => {
  const content =
    "# Notes\n\n<!-- 2026-09-21 10:00:00 -->\nFirst\n\n<!-- 2026-09-22 10:00:00 -->\nSecond\n";

  expect(removeTimestampEntries(content, "2026-09-21 10:00:00")).toEqual({
    content: "# Notes\n\n<!-- 2026-09-22 10:00:00 -->\nSecond\n",
    count: 1,
  });
  expect(removeTimestampEntries(content, "2026-09-22 10:00:00")).toEqual({
    content: "# Notes\n\n<!-- 2026-09-21 10:00:00 -->\nFirst\n\n",
    count: 1,
  });
});
