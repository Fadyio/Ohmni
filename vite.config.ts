import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function buildInfoPlugin(buildSha: string): Plugin {
  return {
    name: "ohmni-build-info",
    buildStart() {
      const buildInfo = {
        name: "ohmni",
        version: "0.1.0",
        buildSha,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? "production" : "development",
      };
      try {
        writeFileSync(
          fileURLToPath(new URL("./public/build-info.json", import.meta.url)),
          JSON.stringify(buildInfo, null, 2) + "\n"
        );
      } catch {
        // Ignore if running on read-only FS
      }
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source:
          JSON.stringify(
            {
              name: "ohmni",
              version: "0.1.0",
              buildSha,
              timestamp: new Date().toISOString(),
              environment: process.env.VERCEL ? "production" : "development",
            },
            null,
            2
          ) + "\n",
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  let buildSha = env.VERCEL_GIT_COMMIT_SHA || env.VITE_BUILD_SHA || "";
  if (!buildSha) {
    try {
      buildSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {
      buildSha = "unknown";
    }
  }

  return {
    define: {
      "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
    },
    plugins: [react(), buildInfoPlugin(buildSha)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: "dist",
      target: "esnext",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-dom") || id.includes("react/") || id.includes("scheduler")) {
                return "react-vendor";
              }
              if (id.includes("gsap") || id.includes("motion")) {
                return "animation-vendor";
              }
              if (id.includes("lucide-react")) {
                return "icons-vendor";
              }
              return "vendor";
            }
          },
        },
      },
    },
  };
});
