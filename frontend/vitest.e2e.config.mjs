import { defineConfig, loadEnv } from "vite";

// Browser tests: start `next dev` on E2E_PORT and drive the installed Microsoft Edge
// (or Chrome via E2E_BROWSER=chrome) with playwright-core, against the real Supabase +
// Cloudinary from .env.
export default defineConfig(({ mode }) => ({
  test: {
    env: { ...loadEnv(mode, process.cwd(), ""), E2E_PORT: "3123" },
    include: ["tests/e2e/**/*.e2e.js"],
    globalSetup: ["tests/e2e/server.js"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
}));
