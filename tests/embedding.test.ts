import { expect, test } from "bun:test";

import {
  EMBEDDING_MODEL_ID,
  EMBEDDING_VERSION,
  formatEmbeddingInput,
} from "../src/embedding.js";

test("uses the Qwen embedding contract", () => {
  expect(EMBEDDING_MODEL_ID).toBe("onnx-community/Qwen3-Embedding-0.6B-ONNX");
  expect(EMBEDDING_VERSION).toBe("qwen3-0.6b-fp32-last-token-v1");
});

test("formats Qwen queries with the retrieval instruction", () => {
  expect(formatEmbeddingInput("find the architecture", "search_query")).toBe(
    "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:find the architecture"
  );
});

test("leaves Qwen document text unprefixed", () => {
  expect(formatEmbeddingInput("Architecture\nFastAPI", "search_document")).toBe(
    "Architecture\nFastAPI"
  );
});
