import { pipeline } from "@huggingface/transformers";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

process.env.TRANSFORMERS_VERBOSITY = "error";
process.env.ORT_LOGGING_LEVEL = "error";

export const EMBEDDING_MODEL_ID = "onnx-community/Qwen3-Embedding-0.6B-ONNX";
export const EMBEDDING_VERSION = "qwen3-0.6b-fp32-last-token-v1";

const EMBEDDING_DTYPE = "fp32";
const QUERY_INSTRUCTION =
  "Given a web search query, retrieve relevant passages that answer the query";

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
  const modelDirectory = path.join(getModelCachePath(), "onnx");
  const modelPath = path.join(modelDirectory, "model.onnx");
  const externalDataPath = path.join(modelDirectory, "model.onnx_data");

  if (!fs.existsSync(modelPath) || !fs.existsSync(externalDataPath)) {
    return false;
  }

  return (
    fs.statSync(modelPath).size >= 1000000 &&
    fs.statSync(externalDataPath).size >= 1000000
  );
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
  task: "search_document" | "search_query"
): string {
  if (task === "search_query") {
    return `Instruct: ${QUERY_INSTRUCTION}\nQuery:${text}`;
  }

  return text;
}

export async function embedText(
  text: string,
  task: "search_document" | "search_query"
): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(formatEmbeddingInput(text, task), {
    pooling: "last_token",
    normalize: true,
  });
  return Array.from(output.data) as number[];
}

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
