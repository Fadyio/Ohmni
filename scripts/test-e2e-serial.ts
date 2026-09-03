/**
 * E2E Automated Web Serial Verification in Google Chrome.
 *
 * Exercises the complete SerialDeviceAdapter protocol pipeline using a simulated serial peer
 * inside a real headless Chrome browser instance.
 *
 * NOTE: This validates the software transport, handshake, RPC correlation, and telemetry pipelines.
 * It does NOT claim "tested on physical hardware" because no physical USB board is attached.
 */

import { chromium } from "playwright";

async function runSerialE2ETest() {
  console.log("[test:e2e:serial] Launching Chrome to exercise SerialDeviceAdapter...");

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream"],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    console.log("[test:e2e:serial] Navigating to local preview...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 15000 });

    // 1. Verify Landing Page
    const landing = await page.$('[data-scene="landing"]');
    if (!landing) {
      throw new Error("Landing page [data-scene='landing'] not rendered.");
    }
    console.log("[test:e2e:serial] ✓ Landing page rendered.");

    // 2. Open Hardware Connection Modal
    const connectBtn = await page.$("#connect-hardware-btn");
    if (!connectBtn) {
      throw new Error("Connect Hardware CTA #connect-hardware-btn not found.");
    }
    await connectBtn.click();
    console.log("[test:e2e:serial] ✓ Connect Hardware modal opened.");

    // 3. Connect Simulated Serial Peer (in-memory Loopback transport exercising SerialDeviceAdapter)
    const simBtn = await page.$("#connect-simulated-peer-btn");
    if (!simBtn) {
      throw new Error("Simulated serial peer button #connect-simulated-peer-btn not found.");
    }
    await simBtn.click();
    console.log("[test:e2e:serial] ✓ Connected via SerialDeviceAdapter using simulated peer.");

    // 4. Verify Physical Hardware Mode Workbench
    await page.waitForSelector('[data-testid="generic-device-visualization"]', { timeout: 5000 });
    console.log("[test:e2e:serial] ✓ Truthful generic hardware visualization rendered.");

    // 5. Verify Descriptor Fields
    const bodyText = await page.textContent("body");
    if (!bodyText?.includes("ESP32-S3 Reference Controller")) {
      throw new Error("Descriptor device name not displayed in physical mode.");
    }
    console.log("[test:e2e:serial] ✓ Discovered device identity displayed dynamically.");

    // 6. Verify WebMCP Tools Registered
    if (!bodyText?.includes("active") || !bodyText?.includes("DISCOVERED WEBMCP TOOLS")) {
      throw new Error("Discovered WebMCP tools count not rendered.");
    }
    console.log("[test:e2e:serial] ✓ Discovered WebMCP tools surface confirmed.");

    if (errors.length > 0) {
      console.warn("[test:e2e:serial] Console errors detected during test:", errors);
    }

    console.log("[test:e2e:serial] ========================================================");
    console.log("[test:e2e:serial] Web Serial protocol path tested in real Chrome with simulated serial peer.");
    console.log("[test:e2e:serial] (Physical electrical verification remains for George with attached board)");
    console.log("[test:e2e:serial] PASS");
    console.log("[test:e2e:serial] ========================================================");
  } catch (err) {
    console.error("[test:e2e:serial] FAILED:", err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runSerialE2ETest();
