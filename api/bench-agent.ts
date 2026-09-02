import { createBenchAgentHandler } from "../server/bench-agent/handler";

const handler = createBenchAgentHandler({
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  },
});

export const GET = (request: Request) => handler(request);
export const POST = (request: Request) => handler(request);

export default {
  fetch(request: Request) {
    return handler(request);
  },
};
