// Vitest globalSetup: runs `next dev` for the browser tests and waits until it answers
import { spawn } from "child_process";

export default async function setup() {
  const port = process.env.E2E_PORT || "3123";
  const server = spawn("npx", ["next", "dev", "-p", port], {
    shell: true,
    stdio: "ignore",
    env: process.env,
  });
  const url = `http://localhost:${port}`;
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`next dev did not start on ${url}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return () => {
    // `shell: true` wraps next in a shell; kill the whole tree
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    else server.kill("SIGTERM");
  };
}
