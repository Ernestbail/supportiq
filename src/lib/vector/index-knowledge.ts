
import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { pipeline } from "@huggingface/transformers";
import { policyDocuments } from "../knowledge/knowledge-base.ts";

const COLLECTION_NAME = "supportiq_knowledge";
const CHUNK_SIZE = 450;
const CHUNK_OVERLAP = 75;

type TextChunk = {
  id: string;
  policyId: string;
  title: string;
  category: string;
  content: string;
  chunkIndex: number;
};

function toUuid(value: string): string {
  const hex = createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function chunkPolicy(
  policy: (typeof policyDocuments)[number]
): TextChunk[] {
  const text = `${policy.title}\n${policy.content}`;
  const words = text.split(/\s+/).filter(Boolean);

  const chunks: TextChunk[] = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);

    const content = words.slice(start, end).join(" ");

    chunks.push({
      id: `${policy.id}-${chunkIndex}`,
      policyId: policy.id,
      title: policy.title,
      category: policy.category,
      content,
      chunkIndex,
    });

    if (end === words.length) {
      break;
    }

    start = end - CHUNK_OVERLAP;
    chunkIndex++;
  }

  return chunks;
}

async function indexKnowledge() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Missing QDRANT_URL or QDRANT_API_KEY.");
  }

  const client = new QdrantClient({
    url,
    apiKey,
  });

  let extractor:
    | Awaited<ReturnType<typeof pipeline>>
    | undefined;

  try {
    console.log("Preparing support policy chunks...");

    const chunks = policyDocuments.flatMap(chunkPolicy);

    if (chunks.length === 0) {
      throw new Error("No policy documents were found.");
    }

    console.log(`Created ${chunks.length} policy chunks.`);

    console.log("Loading local embedding model...");

    extractor = await pipeline(
      "feature-extraction",
      "onnx-community/all-MiniLM-L6-v2-ONNX"
    );

    console.log("Embedding model loaded.");

    const points = [];

    for (const chunk of chunks) {
      console.log(`Generating embedding: ${chunk.id}`);

      const output = await extractor(chunk.content, {
        pooling: "mean",
        normalize: true,
      });

      const vector = Array.from(output.data);

      if (vector.length !== 384) {
        throw new Error(
          `Expected 384 dimensions for ${chunk.id}, received ${vector.length}.`
        );
      }

      points.push({
        id: toUuid(chunk.id),
        vector,
        payload: {
          policyId: chunk.policyId,
          title: chunk.title,
          category: chunk.category,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
        },
      });
    }

    console.log(`Generated ${points.length} embeddings.`);
    console.log("Uploading vectors to Qdrant...");

    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });

    const collection = await client.getCollection(COLLECTION_NAME);

    console.log("Knowledge indexing completed successfully.");
    console.log("Indexed chunks:", points.length);
    console.log("Qdrant collection points:", collection.points_count);
  } catch (error) {
    console.error("Knowledge indexing failed.");

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;
  } finally {
    if (extractor) {
      await extractor.dispose();
    }
  }
}

indexKnowledge();
