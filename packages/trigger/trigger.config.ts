import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_vojknewnlqvcxxzfpgli",
  dirs: ["./src/trigger"],
  runtime: "node",
  maxDuration: 900, // 15 min — processing 10 videos with transcripts + summaries
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
    },
  },
});
