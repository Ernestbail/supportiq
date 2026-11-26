import { QdrantClient } from "@qdrant/js-client-rest";

async function createCollection() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("Missing Qdrant environment variables.");
  }

  const client = new QdrantClient({
    url,
    apiKey,
  });

  const collectionName = "supportiq_knowledge";

  try {
    const existing = await client.getCollections();

    const alreadyExists = existing.collections.some(
      (collection) => collection.name === collectionName
    );

    if (alreadyExists) {
      console.log(`Collection "${collectionName}" already exists.`);
    } else {
      await client.createCollection(collectionName, {
        vectors: {
          size: 384,
          distance: "Cosine",
        },
      });

      console.log(`Collection "${collectionName}" created successfully.`);
    }

    const details = await client.getCollection(collectionName);

    console.log("Vector configuration:", details.config.params.vectors);
  } catch (error) {
    console.error("Collection setup failed.");

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;
  }
}

createCollection();