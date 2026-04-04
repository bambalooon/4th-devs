import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseClient } from "@langfuse/client";

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

const spanProcessor = new LangfuseSpanProcessor();

const sdk = new NodeSDK({
    spanProcessors: [spanProcessor],
});

sdk.start();

export const langfuse = new LangfuseClient();

export async function shutdownTracing(): Promise<void> {
    await sdk.shutdown();
}
