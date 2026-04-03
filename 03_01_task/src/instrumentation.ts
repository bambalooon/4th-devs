import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();