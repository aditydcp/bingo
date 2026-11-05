import { defineConfig, loadEnv } from "vite";

// Unit tests are pure. Integration tests call the API route handlers in-process against
// the real Supabase + Cloudinary from .env / .env.local, so they run one file at a time.
export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    include: ["tests/**/*.test.js"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
}));
