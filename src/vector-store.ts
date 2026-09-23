import path from "path";
import { LocalIndex } from "vectra";

import { getMemoryDir } from "./config.js";
import { hashContent } from "./embedding.js";

type IndexType = "root" | "daily" | "project";
const EMBEDDING_VERSION = "nomic-v1.5-search-prefixes";

interface IndexConfig {
  name: IndexType;
  path: string;
  instance: LocalIndex | null;
}

const indexes: Record<IndexType, IndexConfig> = {
  root: {
    name: "root",
    path: path.join(getMemoryDir(), "root.index"),
    instance: null,
  },
  daily: {
    name: "daily",
    path: path.join(getMemoryDir(), "daily.index"),
    instance: null,
  },
  project: {
    name: "project",
    path: path.join(getMemoryDir(), "project.index"),
    instance: null,
  },
};

// Track initialization promises to prevent race conditions
const initPromises = new Map<IndexType, Promise<LocalIndex>>();

async function getIndex(type: IndexType): Promise<LocalIndex> {
  const config = indexes[type];

  // Return existing instance
  if (config.instance) {
    return config.instance;
  }

  // Check if initialization is already in progress
  const existing = initPromises.get(type);
  if (existing) {
    return existing;
  }

  // Create new initialization promise
  const initPromise = (async () => {
    try {
      const instance = new LocalIndex(config.path);
      if (!(await instance.isIndexCreated())) {
        await instance.createIndex();
      }
      config.instance = instance;
      return instance;
    } catch (error) {
      // Clear on error so next call can retry
      initPromises.delete(type);
      throw error;
    }
  })();

  initPromises.set(type, initPromise);
  return initPromise;
}

async function getIndexForFile(filePath: string): Promise<LocalIndex> {
  if (filePath.includes("/daily/")) {
    return getIndex("daily");
  } else if (filePath.includes("/project/")) {
    return getIndex("project");
  }
  return getIndex("root");
}

export interface EmbeddedChunk {
  text: string;
  heading: string;
  hash: string;
  timestamp?: string;
}

export async function upsertFile(
  filePath: string,
  chunks: EmbeddedChunk[]
): Promise<void> {
  const index = await getIndexForFile(filePath);

  const existing = await index.listItems();
  const existingByHash = new Map<string, string>();

  for (const item of existing) {
    if (item.metadata && String(item.metadata.filePath) === filePath) {
      existingByHash.set(String(item.metadata.chunkHash), String(item.id));
    }
  }

  const newHashes = new Set(
    chunks.map((chunk) => `${EMBEDDING_VERSION}:${chunk.hash}`)
  );

  // Remove outdated chunks
  for (const [hash, id] of existingByHash) {
    if (!newHashes.has(hash)) {
      await index.deleteItem(id);
    }
  }

  // Import embedText here to avoid circular dependency
  const { embedText } = await import("./embedding.js");

  // Insert or update chunks
  for (const chunk of chunks) {
    const chunkHash = `${EMBEDDING_VERSION}:${chunk.hash}`;
    const id = hashContent(`${filePath}:${chunkHash}`);
    if (existingByHash.get(chunkHash) === id) {
      continue;
    }

    const embedding = await embedText(chunk.text, "search_document");
    const previousId = existingByHash.get(chunkHash);
    await index.upsertItem({
      id,
      vector: embedding,
      metadata: {
        filePath,
        heading: chunk.heading,
        text: chunk.text,
        chunkHash,
        ...(chunk.timestamp ? { timestamp: chunk.timestamp } : {}),
      },
    });
    if (previousId && previousId !== id) {
      await index.deleteItem(previousId);
    }
  }
}

export interface SearchResult {
  score: number;
  filePath: string;
  heading: string;
  text: string;
  timestamp?: string;
}

function mapSearchResult(item: {
  score: number;
  item: { metadata: Record<string, unknown> };
}): SearchResult {
  return {
    score: item.score,
    filePath: String(item.item.metadata.filePath),
    heading: String(item.item.metadata.heading),
    text: String(item.item.metadata.text),
    timestamp: item.item.metadata.timestamp
      ? String(item.item.metadata.timestamp)
      : undefined,
  };
}

export async function semanticSearch(
  queryVector: number[],
  topK: number = 20,
  period?: string
): Promise<SearchResult[]> {
  if (period) {
    const dailyIdx = await getIndex("daily");
    const items = await dailyIdx.listItems();
    const results = await dailyIdx.queryItems(queryVector, "", items.length);
    return results
      .map(mapSearchResult)
      .filter((result) => path.basename(result.filePath).startsWith(period))
      .slice(0, topK);
  }

  // Sequential initialization to avoid Bun NAPI concurrency issues
  const rootIdx = await getIndex("root");
  const dailyIdx = await getIndex("daily");
  const projectIdx = await getIndex("project");

  // Sequential queries - safer for SQLite + Bun NAPI
  const rootResults = await rootIdx.queryItems(queryVector, "", topK);
  const dailyResults = await dailyIdx.queryItems(queryVector, "", topK);
  const projectResults = await projectIdx.queryItems(queryVector, "", topK);

  const results: SearchResult[] = [
    ...rootResults.map(mapSearchResult),
    ...dailyResults.map(mapSearchResult),
    ...projectResults.map(mapSearchResult),
  ];

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export async function checkIndexExists(type: IndexType): Promise<boolean> {
  const index = await getIndex(type);
  const items = await index.listItems();
  return items.length > 0;
}

// Cleanup function - called only when explicitly needed (e.g., reindex tool)
export async function closeIndexes(): Promise<void> {
  for (const config of Object.values(indexes)) {
    if (config.instance) {
      // Clear the reference - actual SQLite cleanup happens in finalizer
      config.instance = null;
    }
  }
  initPromises.clear();
  // Small delay to let any pending operations complete
  await new Promise((resolve) => setTimeout(resolve, 100));
}

// Delete all index files - for reindexing
export async function clearIndexes(): Promise<void> {
  // Clear in-memory instances first
  await closeIndexes();

  const fs = await import("node:fs");

  for (const config of Object.values(indexes)) {
    try {
      // Remove index directory recursively
      if (fs.existsSync(config.path)) {
        fs.rmSync(config.path, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(
        `[embedding] Failed to clear index ${config.name}:`,
        (err as Error).message
      );
    }
  }
}
