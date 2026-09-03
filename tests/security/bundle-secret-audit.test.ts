import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Phase 12 — Client Bundle Security Audit", () => {
  it("strictly guarantees zero secret credentials in production build assets", () => {
    const distDir = join(process.cwd(), "dist");
    if (!existsSync(distDir)) {
      execSync("bun run build", { stdio: "pipe" });
    }

    const issues: string[] = [];
    let auditedFileCount = 0;

    const scanDirectory = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".html") ||
          entry.name.endsWith(".css")
        ) {
          auditedFileCount++;
          const content = readFileSync(fullPath, "utf-8");

          // Forbidden: GROQ_API_KEY, gsk_, Authorization Bearer secret, Gemini secrets
          if (content.includes("GROQ_API_KEY")) {
            issues.push(`Forbidden token 'GROQ_API_KEY' found in ${entry.name}`);
          }
          if (/gsk_[0-9A-Za-z_-]{10,}/.test(content)) {
            issues.push(`Forbidden pattern 'gsk_*' found in ${entry.name}`);
          }
          if (/Authorization:\s*Bearer\s+["']?[a-zA-Z0-9_\-]{16,}/i.test(content)) {
            issues.push(`Forbidden Authorization Bearer secret found in ${entry.name}`);
          }
          if (content.includes("AIzaSy")) {
            issues.push(`Forbidden pattern 'AIzaSy' found in ${entry.name}`);
          }
          if (/GEMINI_API_KEY\s*[:=]\s*["'][^"']+["']/.test(content)) {
            issues.push(`Forbidden GEMINI_API_KEY pattern found in ${entry.name}`);
          }
        }
      }
    };

    scanDirectory(distDir);

    expect(auditedFileCount).toBeGreaterThan(0);
    expect(issues).toEqual([]);
  });
});
