// Integration helpers: real Supabase users + API route handlers called in-process.
// Every user made here is deleted (with their rows and Cloudinary photos) by cleanup().
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import meHandler from "../../src/pages/api/me";
import stateHandler from "../../src/pages/api/state";
import cellsHandler from "../../src/pages/api/cells";
import signatureHandler from "../../src/pages/api/upload-signature";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Integration tests need Supabase + Cloudinary vars in frontend/.env");
}
export const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anonClient = () => createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

const createdUserIds = [];
const realUploadUsers = new Set();

// Calls a Next.js API handler with a minimal req/res pair → { status, body }
export async function call(handler, { method = "GET", token, body, query = {} } = {}) {
  let status = 200;
  let payload;
  const res = {
    status(code) {
      status = code;
      return res;
    },
    json(data) {
      payload = data;
      return res;
    },
  };
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  await handler({ method, headers, body, query }, res);
  return { status, body: payload };
}

// A signed-in (non-guest) user; `alias` also creates their profile, `admin` adds them to admins.
// Signs in through a server-generated magic link, which works even with CAPTCHA protection on.
export async function makeUser({ alias, admin = false } = {}) {
  const email = `test-${crypto.randomUUID()}@bingo.test`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const session = await anonClient().auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (session.error) throw session.error;
  const user = { id: data.user.id, email, token: session.data.session.access_token };
  if (admin) {
    const { error: e } = await db.from("admins").insert({ user_id: user.id });
    if (e) throw e;
  }
  if (alias) await setAlias(user, alias);
  return user;
}

// A real anonymous (guest) sign-in, like "Main sebagai Tamu"
export async function makeGuest({ alias } = {}) {
  const { data, error } = await anonClient().auth.signInAnonymously();
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const user = { id: data.user.id, token: data.session.access_token };
  if (alias) await setAlias(user, alias);
  return user;
}

export async function setAlias(user, alias) {
  const r = await call(meHandler, { method: "POST", token: user.token, body: { name: alias } });
  if (r.status !== 200) throw new Error(`setAlias ${r.status} ${JSON.stringify(r.body)}`);
  return r;
}

export const uniqueAlias = (prefix = "Tester") => `${prefix} ${crypto.randomUUID().slice(0, 8)}`;

export async function getState(user) {
  const r = await call(stateHandler, { token: user.token });
  if (r.status !== 200) throw new Error(`state ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

// A Cloudinary URL/public_id pair that passes isOwnUpload without uploading anything
export function fakePhoto(user, cellId) {
  const publicId = `bingo/${user.id}/${cellId}_${Date.now()}${crypto.randomInt(1000)}`;
  return {
    publicId,
    photoUrl: `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/${publicId}.png`,
  };
}

// Records a photo at `position` (fake URL) through POST /api/cells
export async function mark(user, position, board) {
  const cellId = (board || (await getState(user)).board)[position].cellId;
  return call(cellsHandler, {
    method: "POST",
    token: user.token,
    body: { position, ...fakePhoto(user, cellId) },
  });
}

export async function markAll(user, positions) {
  const { board } = await getState(user);
  const results = [];
  for (const p of positions) {
    const r = await mark(user, p, board);
    if (r.status !== 200) throw new Error(`mark ${p}: ${r.status} ${JSON.stringify(r.body)}`);
    results.push(r);
  }
  return results;
}

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// The full browser flow: signature → direct upload to Cloudinary → returns the upload response
export async function uploadToCloudinary(user, position) {
  const sig = await call(signatureHandler, { method: "POST", token: user.token, body: { position } });
  if (sig.status !== 200) throw new Error(`signature ${sig.status} ${JSON.stringify(sig.body)}`);
  realUploadUsers.add(user.id);
  const fd = new FormData();
  fd.append("file", new Blob([PNG], { type: "image/png" }), "p.png");
  fd.append("api_key", sig.body.apiKey);
  fd.append("timestamp", String(sig.body.timestamp));
  fd.append("public_id", sig.body.publicId);
  fd.append("signature", sig.body.signature);
  const res = await fetch(sig.body.uploadUrl, { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(`cloudinary ${res.status} ${JSON.stringify(json)}`);
  return { sig: sig.body, uploaded: json };
}

// master_config is shared: tests swap in their own pool/window and restore the original
let savedConfig;
export async function saveConfig() {
  const { data, error } = await db
    .from("master_config")
    .select("cells, event_start, event_end")
    .eq("id", 1)
    .single();
  if (error) throw error;
  savedConfig = data;
}
export async function setConfig({ cells, eventStart = null, eventEnd = null }) {
  const { error } = await db
    .from("master_config")
    .update({ ...(cells && { cells }), event_start: eventStart, event_end: eventEnd })
    .eq("id", 1);
  if (error) throw error;
}
export async function restoreConfig() {
  if (savedConfig) await db.from("master_config").update(savedConfig).eq("id", 1);
}

// 30-cell test pool: IDs 0–29, free cell at ID 12
export const testPool = (rules = {}) =>
  Array.from({ length: 30 }, (_, id) =>
    id === 12 ? { id, label: "GARUT", free: true } : { id, label: `Test cell ${id}`, ...rules[id] },
  );

export async function cleanup() {
  for (const id of createdUserIds.splice(0)) {
    await db.auth.admin.deleteUser(id); // cascades to profiles, boards, states, history, records, admins
  }
  const auth = "Basic " + Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");
  for (const id of realUploadUsers) {
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload?prefix=${encodeURIComponent(`bingo/${id}/`)}`,
      { method: "DELETE", headers: { Authorization: auth } },
    );
  }
  realUploadUsers.clear();
}

export const ROW0 = [0, 1, 2, 3, 4];
export const COL0 = [0, 5, 10, 15, 20];
export const PHOTO_POSITIONS = [...Array(25).keys()].filter((p) => p !== 12);
