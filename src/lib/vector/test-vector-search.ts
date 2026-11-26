
import { QdrantClient } from "@qdrant/js-client-rest";
import { pipeline } from "@huggingface/transformers";

const COLLECTION_NAME = "supportiq_knowledge";

const testQuestions = [
  {
    question: "I paid recently but I want my money back.",
    expected: "refund",
  },
  {
    question: "Why am I being charged every month?",
    expected: "subscription",
  },
  {
    question: "I cannot sign in because I forgot my password.",
    expected: "account",
  },
  {
    question: "My application keeps crashing when I open it.",
    expected: "technical",
  },
  {
    question: "What is the capital of France?",
    expected: "unrelated",
  },
];

async function testVectorSearch() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Missing QDRANT_URL or QDRANT_API_KEY.");
  }

  const client = new QdrantClient({ url, apiKey });

  let extractor:
    | Awaited<ReturnType<typeof pipeline>>
    | undefined;

  try {
    console.log("Loading embedding model...");

    extractor = await pipeline(
      "feature-extraction",
      "onnx-community/all-MiniLM-L6-v2-ONNX"
    );

    for (const test of testQuestions) {
      console.log("\n================================");
      console.log("Question:", test.question);
      console.log("Expected:", test.expected);

      const output = await extractor(test.question, {
        pooling: "mean",
        normalize: true,
      });

      const vector = Array.from(output.data);

      const results = await client.query(COLLECTION_NAME, {
        query: vector,
        limit: 3,
        with_payload: true,
      });

      const topResult = results.points[0];

      if (!topResult) {
        console.log("No results returned.");
        continue;
      }

      console.log("Top category:", topResult.payload?.category);
      console.log("Similarity score:", topResult.score);
      console.log("Correct category:",
        topResult.payload?.category === test.expected
      );
    }

    console.log("\nVector retrieval tests completed.");
  } catch (error) {
    console.error("Vector search failed.");

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

testVectorSearch();
