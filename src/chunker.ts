import { hashContent } from "./embedding.js";

export interface Chunk {
  text: string;
  heading: string;
  filePath: string;
  hash: string;
  timestamp?: string;
}

const MAX_CHUNK_LENGTH = 1200;

export function chunkMarkdown(content: string, filePath: string): Chunk[] {
  const chunks: Chunk[] = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const timestampRegex =
    /^<!--\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)\s*-->[ \t]*$/gm;

  const addSection = (body: string, heading: string, timestamp?: string) => {
    const limit = Math.max(1, MAX_CHUNK_LENGTH - heading.length - 1);
    const sections: string[] = [];
    let current = "";

    for (const paragraph of body.trim().split(/\n\s*\n/)) {
      let remaining = paragraph.trim();
      while (remaining.length > limit) {
        if (current) sections.push(current);
        current = "";
        const line = remaining.lastIndexOf("\n", limit);
        const space = remaining.lastIndexOf(" ", limit);
        const end = line > limit / 2 ? line : space > limit / 2 ? space : limit;
        sections.push(remaining.slice(0, end).trim());
        remaining = remaining.slice(end).trimStart();
      }
      if (!remaining) continue;
      if (current && current.length + remaining.length + 2 > limit) {
        sections.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${remaining}` : remaining;
    }
    if (current) sections.push(current);
    if (!sections.length && heading) sections.push("");

    for (const section of sections) {
      const text = [heading, section].filter(Boolean).join("\n");
      chunks.push({
        text,
        heading,
        filePath,
        hash: hashContent(`${filePath}:${timestamp ?? ""}:${heading}:${text}`),
        timestamp,
      });
    }
  };

  const addEntry = (entry: string, timestamp?: string) => {
    const headings = [...entry.matchAll(headingRegex)];
    if (!headings.length) addSection(entry, "", timestamp);
    else {
      addSection(entry.slice(0, headings[0].index), "", timestamp);
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const end = headings[i + 1]?.index ?? entry.length;
        addSection(
          entry.slice(heading.index + heading[0].length, end),
          heading[2].trim(),
          timestamp
        );
      }
    }
  };

  const markers = [...content.matchAll(timestampRegex)];
  if (!markers.length) addEntry(content);
  else {
    addEntry(content.slice(0, markers[0].index));
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      addEntry(
        content.slice(marker.index + marker[0].length, markers[i + 1]?.index),
        marker[1]
      );
    }
  }

  return chunks;
}
