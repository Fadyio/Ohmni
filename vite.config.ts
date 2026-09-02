import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import {
  MAX_REQUEST_BODY_BYTES,
  createBenchAgentHandler,
  type BenchAgentHandler,
} from "./server/bench-agent/handler.ts";

const LOCAL_AGENT_PATH = "/api/bench-agent";
const SKIPPED_NODE_HEADERS: Readonly<Record<string, true>> = {
  connection: true,
  "content-length": true,
  host: true,
  "transfer-encoding": true,
};

function collectRequestBody(
  request: IncomingMessage,
): Promise<string | undefined> {
  const { promise, resolve, reject } =
    Promise.withResolvers<string | undefined>();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let tooLarge = false;

  request.on("data", (chunk: Buffer | string) => {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    if (!tooLarge) {
      chunks.push(bytes);
    }
  });
  request.on("end", () => {
    resolve(tooLarge ? undefined : Buffer.concat(chunks, totalBytes).toString("utf8"));
  });
  request.on("error", reject);
  return promise;
}

function copyNodeHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Object.hasOwn(SKIPPED_NODE_HEADERS, name)) {
      continue;
    }
    if (typeof value === "string") {
      headers.append(name, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    }
  }
  return headers;
}

async function sendWebResponse(
  response: Response,
  nodeResponse: ServerResponse,
): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, name) => {
    nodeResponse.setHeader(name, value);
  });
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

function benchAgentPlugin(handler: BenchAgentHandler): Plugin {
  return {
    name: "ohmni-bench-agent",
    configureServer(server) {
      server.middlewares.use(
        LOCAL_AGENT_PATH,
        async (request, response, next) => {
          try {
            const method = request.method ?? "GET";
            const body =
              method === "GET" || method === "HEAD"
                ? null
                : await collectRequestBody(request);
            if (body === undefined) {
              await sendWebResponse(
                new Response(
                  JSON.stringify({
                    error: "PAYLOAD TOO LARGE",
                    message: "Request body exceeds 128 KiB.",
                  }),
                  {
                    status: 413,
                    headers: {
                      "content-type": "application/json; charset=utf-8",
                    },
                  },
                ),
                response,
              );
              return;
            }

            const forwardedProtocol = request.headers["x-forwarded-proto"];
            const protocolHeader = Array.isArray(forwardedProtocol)
              ? forwardedProtocol[0]
              : forwardedProtocol;
            const protocol =
              protocolHeader?.split(",", 1)[0]?.trim() ||
              ("encrypted" in request.socket && request.socket.encrypted
                ? "https"
                : "http");
            const host = request.headers.host ?? "localhost";
            const abortController = new AbortController();
            request.once("aborted", () => abortController.abort());
            response.once("close", () => {
              if (!response.writableEnded) {
                abortController.abort();
              }
            });

            const webRequest = new Request(
              `${protocol}://${host}${LOCAL_AGENT_PATH}`,
              {
                method,
                headers: copyNodeHeaders(request),
                body,
                signal: abortController.signal,
              },
            );
            await sendWebResponse(await handler(webRequest), response);
          } catch (error) {
            next(error);
          }
        },
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const handler = createBenchAgentHandler({
    env: {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
    },
  });

  return {
    plugins: [react(), benchAgentPlugin(handler)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: "dist",
      target: "esnext",
      sourcemap: true,
      chunkSizeWarningLimit: 800,
    },
  };
});
