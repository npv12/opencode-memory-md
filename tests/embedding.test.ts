import { expect, test } from "bun:test";

import {
  EMBEDDING_MODEL_ID,
  EMBEDDING_VERSION,
  formatEmbeddingInput,
} from "../src/embedding.js";

test("uses the Snowflake Arctic embedding contract", () => {
  expect(EMBEDDING_MODEL_ID).toBe(
    "Snowflake/snowflake-arctic-embed-m-v2.0"
  );
  expect(EMBEDDING_VERSION).toBe(
    "snowflake-arctic-embed-m-v2.0-fp32-cls-v1"
  );
});

test("formats Snowflake queries with the retrieval prefix", () => {
  expect(formatEmbeddingInput("find the architecture", "search_query")).toBe(
    "query: find the architecture"
  );
});

test("leaves Snowflake document text unprefixed", () => {
  expect(formatEmbeddingInput("Architecture\nFastAPI", "search_document")).toBe(
    "Architecture\nFastAPI"
  );
});
