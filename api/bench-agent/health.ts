import type { IncomingMessage, ServerResponse } from "node:http";
import { createBenchAgentHandler, type BenchAgentHandler } from "../../server/bench-agent/handler";

const webHandler: BenchAgentHandler = createBenchAgentHandler({
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  },
});

async function nodeToWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host || "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const url = new URL(req.url || "/api/bench-agent/health", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  let body: BodyInit | undefined = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const rawBody = (req as unknown as { body?: unknown }).body;
    if (rawBody !== undefined && rawBody !== null) {
      if (typeof rawBody === "string") {
        body = rawBody;
      } else if (Buffer.isBuffer(rawBody)) {
        body = new Uint8Array(rawBody);
      } else if (typeof rawBody === "object") {
        body = JSON.stringify(rawBody);
      }
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
      }
      body = new Uint8Array(Buffer.concat(chunks));
    }
  }

  return new Request(url.toString(), {
    method: req.method || "GET",
    headers,
    body,
  });
}

async function sendWebResponseToNode(webResponse: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const arrayBuffer = await webResponse.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

export async function universalHealthHandler(
  reqOrRequest: IncomingMessage | Request,
  resOrUndefined?: ServerResponse,
): Promise<Response | void> {
  if (resOrUndefined && typeof (resOrUndefined as ServerResponse).setHeader === "function") {
    const nodeReq = reqOrRequest as IncomingMessage;
    const nodeRes = resOrUndefined as ServerResponse;
    try {
      const webReq = await nodeToWebRequest(nodeReq);
      const webRes = await webHandler(webReq);
      await sendWebResponseToNode(webRes, nodeRes);
    } catch (err) {
      console.error("[BenchAgent Health Serverless Error]", err);
      nodeRes.statusCode = 500;
      nodeRes.setHeader("content-type", "application/json");
      nodeRes.end(JSON.stringify({ ok: false, error: "INTERNAL_SERVER_ERROR", message: "Health check server error." }));
    }
    return;
  }

  return webHandler(reqOrRequest as Request);
}

export default universalHealthHandler;

export const GET = (request: Request) => universalHealthHandler(request);
export const POST = (request: Request) => universalHealthHandler(request);
export const OPTIONS = (request: Request) => universalHealthHandler(request);
