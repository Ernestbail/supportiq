
import { QdrantClient } from "@qdrant/js-client-rest";

async function testConnection() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Missing QDRANT_URL or QDRANT_API_KEY in .env.local");
  }

  const client = new QdrantClient({
    url,
    apiKey,
  });

  try {
    console.log("Connecting to Qdrant Cloud...");

    const result = await client.getCollections();

    console.log("Connection successful!");
    console.log(
      "Available collections:",
      result.collections.map((collection) => collection.name)
    );
  } catch (error) {
    console.error("Qdrant connection failed.");

    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

testConnection();
