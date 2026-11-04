import crypto from "crypto";

const CLOUD = () => process.env.CLOUDINARY_CLOUD_NAME;
const KEY = () => process.env.CLOUDINARY_API_KEY;
const SECRET = () => process.env.CLOUDINARY_API_SECRET;

// https://cloudinary.com/documentation/authentication_signatures
export function sign(params) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + SECRET()).digest("hex");
}

// Params the browser needs for a signed direct upload of one cell photo
export function uploadParams(userId, position) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `bingo/${userId}/${position}_${timestamp}`;
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD()}/image/upload`,
    apiKey: KEY(),
    timestamp,
    publicId,
    signature: sign({ public_id: publicId, timestamp }),
  };
}

// The URL the client reports must be the Cloudinary asset for this user + position
export function isOwnUpload(url, publicId, userId, position) {
  if (typeof url !== "string" || typeof publicId !== "string") return false;
  if (!publicId.startsWith(`bingo/${userId}/${position}_`)) return false;
  const prefix = `https://res.cloudinary.com/${CLOUD()}/image/upload/`;
  const escaped = publicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return url.startsWith(prefix) && new RegExp(`/v\\d+/${escaped}\\.\\w+$`).test(url);
}

// Best-effort cleanup; failures are logged, not thrown
export async function destroy(publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: KEY(),
    signature: sign({ public_id: publicId, timestamp }),
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD()}/image/destroy`, {
    method: "POST",
    body,
  }).catch((e) => console.error("cloudinary destroy", e));
  if (res && !res.ok) console.error("cloudinary destroy", res.status, await res.text());
}

export async function destroyUserPhotos(userId) {
  const auth = Buffer.from(`${KEY()}:${SECRET()}`).toString("base64");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD()}/resources/image/upload?prefix=${encodeURIComponent(`bingo/${userId}/`)}`,
    { method: "DELETE", headers: { Authorization: `Basic ${auth}` } },
  ).catch((e) => console.error("cloudinary delete prefix", e));
  if (res && !res.ok) console.error("cloudinary delete prefix", res.status, await res.text());
}
