/**
 * Deployment Smoke Test Script.
 * Verifies that a deployed target URL is healthy, serves valid HTML,
 * contains the application root container, and loads static JS/CSS assets.
 *
 * Usage:
 *   bun run scripts/smoke.ts <URL>
 *   bun run smoke -- https://your-deployment.vercel.app
 */

const targetUrlArg = process.argv[2] || process.env.DEPLOYMENT_URL;

if (!targetUrlArg) {
  console.error("Error: No target URL provided for smoke test.");
  console.error("Usage: bun run smoke -- <DEPLOYMENT_URL>");
  process.exit(1);
}

const rawTarget = targetUrlArg.trim();
const targetUrl = rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
  ? rawTarget
  : `https://${rawTarget}`;

console.info(`[Smoke Test] Target URL: ${targetUrl}`);

async function runSmokeTest(): Promise<void> {
  const startTime = Date.now();

  // 1. Fetch root HTML
  console.info("[Smoke Test] Step 1: Requesting root document...");
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Ohmni-Smoke-Tester/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Root document request failed with HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected text/html content-type, received: ${contentType}`);
  }

  const html = await response.text();
  console.info(`[Smoke Test] Step 1 PASS: HTTP ${response.status}, length ${html.length} bytes`);
  // 1b. Verify Deployment Truth & Build SHA (Phase 19)
  const buildInfoUrl = new URL("/build-info.json", targetUrl).toString();
  console.info(`[Smoke Test] Step 1b: Requesting ${buildInfoUrl}...`);
  let loadedSha = "unknown";
  try {
    const buildInfoRes = await fetch(buildInfoUrl);
    if (buildInfoRes.ok) {
      const buildInfo = (await buildInfoRes.json()) as { buildSha?: string };
      loadedSha = buildInfo.buildSha || "unknown";
    }
  } catch (err) {
    console.warn(`[Smoke Test] Warning: Failed to fetch /build-info.json: ${err}`);
  }

  const expectedSha = process.env.EXPECTED_SHA || process.env.VITE_BUILD_SHA || "unknown";
  console.info(`--------------------------------------------------`);
  console.info(`TARGET URL:   ${targetUrl}`);
  console.info(`LOADED SHA:   ${loadedSha}`);
  console.info(`EXPECTED SHA: ${expectedSha}`);
  console.info(`--------------------------------------------------`);

  if (expectedSha !== "unknown" && loadedSha !== "unknown" && loadedSha !== expectedSha) {
    throw new Error(`Deployment build SHA mismatch! Loaded: ${loadedSha}, Expected: ${expectedSha}`);
  }

  // 2. Verify Application Root
  console.info("[Smoke Test] Step 2: Checking application root element (#app)...");
  if (!html.includes('id="app"') && !html.includes("id='app'")) {
    throw new Error('Application root element (<div id="app">) not found in returned HTML');
  }
  console.info("[Smoke Test] Step 2 PASS: Application root container confirmed.");
  // 3. Extract and Verify Linked JS / CSS Assets
  console.info("[Smoke Test] Step 3: Discovering and verifying referenced static assets...");
  const assetRegex = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
  const assets: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = assetRegex.exec(html)) !== null) {
    if (match[1] && !assets.includes(match[1])) {
      assets.push(match[1]);
    }
  }

  if (assets.length === 0) {
    console.warn("[Smoke Test] Note: No /assets/ links found directly in HTML (may use inline entry or standard scripts).");
  } else {
    for (const assetPath of assets) {
      const assetUrl = new URL(assetPath, targetUrl).toString();
      console.info(`[Smoke Test] Verifying asset: ${assetPath} ...`);
      const assetRes = await fetch(assetUrl);
      if (!assetRes.ok) {
        throw new Error(`Asset verification failed for ${assetUrl}: HTTP ${assetRes.status}`);
      }
      console.info(`[Smoke Test] Asset PASS: ${assetPath} (HTTP ${assetRes.status})`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.info(`[Smoke Test] ALL CHECKS PASSED in ${elapsed}ms.`);
}

runSmokeTest().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Smoke Test] FAILED: ${message}`);
  process.exit(1);
});
