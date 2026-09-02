import { createBenchAgentHandler } from "../server/bench-agent/handler";

const handler = createBenchAgentHandler({
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  },
});

export default handler;
