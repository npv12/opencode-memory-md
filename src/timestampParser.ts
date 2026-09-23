const TIMESTAMP_REGEX =
  /<!--\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)\s*-->/g;

export function extractTimestamps(content: string): string[] {
  const timestamps: string[] = [];
  let match;

  while ((match = TIMESTAMP_REGEX.exec(content)) !== null) {
    timestamps.push(match[1]);
  }

  return timestamps;
}

export function removeTimestampEntries(
  content: string,
  timestamp: string
): { content: string; count: number } {
  const markers = [...content.matchAll(TIMESTAMP_REGEX)];
  let updated = content;
  let count = 0;

  for (let i = markers.length - 1; i >= 0; i--) {
    if (markers[i][1] !== timestamp) continue;
    const end = markers[i + 1]?.index ?? content.length;
    updated = updated.slice(0, markers[i].index) + updated.slice(end);
    count++;
  }

  return { content: updated, count };
}
