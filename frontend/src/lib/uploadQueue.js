// Bad-signal-proof photo uploads. Browser only.
// A taken photo is kept on the phone (IndexedDB, so it survives a reload or the browser
// killing the tab while the camera is open) until the server has it. pages/bingo.js runs
// the queue one photo at a time and retries with backoff while the signal is bad.
import { api, isTransient } from "./supabase";

// ── IndexedDB store of not-yet-sent photos ───────────────────────────
// Item: { key: "<userId>:<position>", userId, position, cellId, blob, createdAt }
const DB_NAME = "piknik-bingo";
const STORE = "pending";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

// Storage is best effort (private mode, old browsers): the queue still works in memory
const quietly = (p, fallback) => p.catch(() => fallback);

export const pendingStore = {
  save: (item) => quietly(withStore("readwrite", (s) => s.put(item)).then(() => true), false),
  remove: (key) => quietly(withStore("readwrite", (s) => s.delete(key))),
  async load(userId) {
    const all = await quietly(withStore("readonly", (s) => s.getAll()), []);
    return (all || []).filter((i) => i.userId === userId);
  },
};

// ── Upload ───────────────────────────────────────────────────────────
// Smaller photos when the browser says the connection is slow or data saver is on
export function photoSizeForConnection() {
  const c = typeof navigator !== "undefined" && navigator.connection;
  if (c && (c.saveData || ["slow-2g", "2g"].includes(c.effectiveType))) return { maxSide: 960, quality: 0.7 };
  if (c && c.effectiveType === "3g") return { maxSide: 1120, quality: 0.75 };
  return { maxSide: 1280, quality: 0.8 };
}

const fail = (message, extra) => Object.assign(new Error(message), { status: 0, ...extra });

// Direct upload to Cloudinary with progress; aborts if no bytes move for `stallMs`
function sendToCloudinary(sig, blob, { onProgress, signal, stallMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stall;
    const arm = () => {
      clearTimeout(stall);
      stall = setTimeout(() => xhr.abort(), stallMs);
    };
    const done = () => {
      clearTimeout(stall);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => xhr.abort();

    xhr.upload.onprogress = (e) => {
      arm();
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      done();
      let json = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300 && json) resolve(json);
      else reject(fail(json?.error?.message || "upload_failed", { status: xhr.status, cloudinary: true }));
    };
    xhr.onerror = () => {
      done();
      reject(fail("network"));
    };
    xhr.onabort = () => {
      done();
      reject(signal?.aborted ? fail("aborted", { aborted: true }) : fail("timeout"));
    };
    signal?.addEventListener("abort", onAbort);

    const fd = new FormData();
    fd.append("file", blob, "photo.jpg");
    fd.append("api_key", sig.apiKey);
    fd.append("timestamp", sig.timestamp);
    fd.append("public_id", sig.publicId);
    fd.append("signature", sig.signature);
    xhr.open("POST", sig.uploadUrl);
    arm();
    xhr.send(fd);
  });
}

// signature → Cloudinary → POST /api/cells. Returns { cell, records }.
export async function uploadPhoto({ position, blob, onProgress, signal }) {
  const sig = await api("/api/upload-signature", { method: "POST", body: { position }, retries: 2 });
  if (signal?.aborted) throw fail("aborted", { aborted: true });
  const uploaded = await sendToCloudinary(sig, blob, { onProgress, signal });
  onProgress?.(1);
  // Recording the same photo twice is harmless, so this is safe to retry
  return api("/api/cells", {
    method: "POST",
    body: { position, photoUrl: uploaded.secure_url, publicId: uploaded.public_id },
    retries: 3,
  });
}

// Should this photo be dropped instead of retried? (e.g. event closed, board changed)
export function isPermanent(err, attempts) {
  if (err.aborted) return true;
  if (err.cloudinary && err.status >= 400 && err.status < 500) return attempts >= 3;
  return !isTransient(err);
}

// 2s, 4s, 8s … capped at 30s
export const backoff = (attempts) => Math.min(30000, 2000 * 2 ** Math.max(0, attempts - 1));
