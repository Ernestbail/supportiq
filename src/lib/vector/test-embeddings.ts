import { pipeline } from "@huggingface/transformers";

async function testEmbeddings() {
  try {
    console.log("Loading the embedding model...");

    const extractor = await pipeline(
      "feature-extraction",
      "onnx-community/all-MiniLM-L6-v2-ONNX"
    );

    console.log("Model loaded successfully.");
    console.log("Generating a test embedding...");

    const output = await extractor(
      "Customers can request a refund within 30 days of purchase.",
      {
        pooling: "mean",
        normalize: true,
      }
    );

    console.log("Embedding dimensions:", output.dims);
    console.log("Vector length:", output.data.length);
    console.log("First five values:", Array.from(output.data).slice(0, 5));

    if (output.data.length !== 384) {
      throw new Error("Expected a 384-dimensional embedding.");
    }

    console.log("Embedding test passed!");

    await extractor.dispose();
  } catch (error) {
    console.error("Embedding test failed:", error);
    process.exitCode = 1;
  }
}

testEmbeddings();