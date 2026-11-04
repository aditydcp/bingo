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

// fetch() wrapper for our API routes that attaches the user's access token
export async function api(path, { method = "GET", body } = {}) {
  const session = await getSession();
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.access_token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}
