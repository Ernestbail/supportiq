
import { QdrantClient } from "@qdrant/js-client-rest";
import { env, pipeline } from "@huggingface/transformers";

// Vercel serverless functions must use a writable directory.
env.cacheDir = process.env.VERCEL
  ? "/tmp/supportiq-hf-cache"
  : ".cache";

const COLLECTION_NAME = "supportiq_knowledge";
const MODEL_NAME = "onnx-community/all-MiniLM-L6-v2-ONNX";
const VECTOR_SIZE = 384;

type PolicyCategory =
  | "refund"
  | "account"
  | "subscription"
  | "technical";

type PolicyPayload = {
  policyId: string;
  title: string;
  category: PolicyCategory;
  content: string;
  chunkIndex: number;
};

export type PolicySearchMatch = {
  policyId: string;
  title: string;
  category: PolicyCategory;
  content: string;
  chunkIndex: number;
  score: number;
};

type EmbeddingOutput = {
  dims: number[];
  data: ArrayLike<number>;
};

type EmbeddingExtractor = (
  text: string,
  options: {
    pooling: "mean";
    normalize: true;
  }
) => Promise<EmbeddingOutput>;

let extractorPromise: Promise<EmbeddingExtractor> | null = null;

function getQdrantClient() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error(
      "Qdrant configuration is missing. Check QDRANT_URL and QDRANT_API_KEY."
    );
  }

  return new QdrantClient({
    url,
    apiKey,
  });
}

async function getEmbeddingExtractor(): Promise<EmbeddingExtractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      MODEL_NAME
    ) as unknown as Promise<EmbeddingExtractor>;
  }

  return extractorPromise;
}

export async function searchKnowledgeBase(
  question: string,
  limit = 3
): Promise<PolicySearchMatch[]> {
  const cleanedQuestion = question.trim();

  if (!cleanedQuestion) {
    return [];
  }

  const extractor = await getEmbeddingExtractor();

  const output = await extractor(cleanedQuestion, {
    pooling: "mean",
    normalize: true,
  });

  if (output.dims[1] !== VECTOR_SIZE) {
    throw new Error(
      `Expected ${VECTOR_SIZE} embedding dimensions, received ${output.dims[1]}.`
    );
  }

  const vector: number[] = Array.from(
    output.data,
    (value) => Number(value)
  );

  const client = getQdrantClient();

  const results = await client.query(COLLECTION_NAME, {
    query: vector,
    limit,
    with_payload: true,
  });

  return results.points.map((point) => {
    const payload = point.payload as unknown as PolicyPayload;

    return {
      policyId: payload.policyId,
      title: payload.title,
      category: payload.category,
      content: payload.content,
      chunkIndex: payload.chunkIndex,
      score: point.score,
    };
  });
}
