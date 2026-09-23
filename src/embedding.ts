import { pipeline } from "@huggingface/transformers";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

process.env.TRANSFORMERS_VERBOSITY = "error";
process.env.ORT_LOGGING_LEVEL = "error";

export const EMBEDDING_MODEL_ID = "Snowflake/snowflake-arctic-embed-m-v2.0";
export const EMBEDDING_VERSION = "snowflake-arctic-embed-m-v2.0-fp32-cls-v1";

const EMBEDDING_DTYPE = "fp32";
const QUERY_PREFIX = "query: ";

type EmbeddingTask = "search_document" | "search_query";

let embedder: any = null;
let initPromise: Promise<void> | null = null;

function getModelCachePath(): string {
  const pluginDir = path.dirname(path.dirname(__dirname));
  return path.join(
    pluginDir,
    "node_modules",
    "@huggingface",
    "transformers",
    ".cache",
    ...EMBEDDING_MODEL_ID.split("/")
  );
}

function isModelCacheValid(): boolean {
  const modelPath = path.join(getModelCachePath(), "onnx", "model.onnx");

  if (!fs.existsSync(modelPath)) {
    return false;
  }

  return fs.statSync(modelPath).size >= 1000000;
}

function clearModelCache(): void {
  try {
    const modelPath = getModelCachePath();
    if (fs.existsSync(modelPath)) {
      fs.rmSync(modelPath, { recursive: true, force: true });
    }
  } catch {}
}

async function initEmbedder(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          if (!isModelCacheValid()) {
            clearModelCache();
          }

          embedder = await pipeline("feature-extraction", EMBEDDING_MODEL_ID, {
            dtype: EMBEDDING_DTYPE,
          });
          return;
        } catch (err) {
          const errMsg = (err as Error).message;
          if (
            errMsg.includes("Protobuf parsing failed") ||
            errMsg.includes("corrupt") ||
            errMsg.includes("out of bounds") ||
            errMsg.includes("External initializer") ||
            errMsg.includes("Deserialize tensor")
          ) {
            clearModelCache();
            retries++;
            if (retries > maxRetries) {
              throw new Error(
                `Failed to load embedding model after ${maxRetries} retries. ` +
                  `Model cache may be corrupted. Try: rm -rf node_modules/@huggingface/transformers/.cache`
              );
            }
            continue;
          }
          throw err;
        }
      }
    })();
  }
  await initPromise;
}

async function getEmbedder(): Promise<any> {
  if (!embedder) {
    await initEmbedder();
  }
  return embedder;
}

export function formatEmbeddingInput(
  text: string,
  task: EmbeddingTask
): string {
  return task === "search_query" ? `${QUERY_PREFIX}${text}` : text;
}

export async function embedText(
  text: string,
  task: EmbeddingTask
): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(formatEmbeddingInput(text, task), {
    pooling: "cls",
    normalize: true,
  });
  return Array.from(output.data) as number[];
}

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
