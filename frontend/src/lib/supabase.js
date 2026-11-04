import { createClient } from "@supabase/supabase-js";

// Browser client. Created lazily so pages can be prerendered without env vars.
let client;
export function supabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return client;
}

export async function getSession() {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

export function signInWithGoogle(redirectPath = "/") {
  return supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + redirectPath },
  });
}

// Upgrade an anonymous (guest) account to Google, keeping the same user ID
export function linkGoogle(redirectPath = "/bingo") {
  return supabase().auth.linkIdentity({
    provider: "google",
    options: { redirectTo: window.location.origin + redirectPath },
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// No response at all (offline, timeout, dropped connection) or a server-side hiccup
export const isTransient = (err) => !err.status || err.status >= 500 || [408, 429].includes(err.status);

async function apiOnce(path, method, body, timeout) {
  const session = await getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(session && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    const err = new Error(controller.signal.aborted ? "timeout" : "network");
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

// fetch() wrapper for our API routes that attaches the user's access token.
// Gives up after `timeout` ms (bad signal shouldn't hang forever) and retries transient
// failures `retries` times (GETs by default; only pass retries for idempotent POSTs).
// Errors carry .status (0 = no response).
export async function api(path, { method = "GET", body, timeout = 20000, retries } = {}) {
  const maxRetries = retries ?? (method === "GET" ? 2 : 0);
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiOnce(path, method, body, timeout);
    } catch (err) {
      if (attempt >= maxRetries || !isTransient(err)) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
}
