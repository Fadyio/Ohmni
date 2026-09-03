import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function getBuildSha(): string {
  const envSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VITE_BUILD_SHA ||
    process.env.GIT_COMMIT_SHA ||
    "";
  if (envSha.trim().length > 0) {
    return envSha.trim();
  }

  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function stampBuild(): void {
  const buildSha = getBuildSha();
  const buildInfo = {
    name: "ohmni",
    version: "0.1.0",
    buildSha,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? "production" : "development",
  };

  const targetPath = fileURLToPath(new URL("../public/build-info.json", import.meta.url));
  writeFileSync(targetPath, JSON.stringify(buildInfo, null, 2) + "\n", "utf8");
  console.info(`[Build Stamping] Stamped buildSha ${buildSha} to ${targetPath}`);
}

if (import.meta.main) {
  stampBuild();
}
