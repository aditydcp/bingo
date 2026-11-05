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

// Params the browser needs for a signed direct upload of one cell photo.
// Photos are never deleted (snapshots and rerolled boards still reference them).
export function uploadParams(userId, cellId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `bingo/${userId}/${cellId}_${timestamp}`;
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD()}/image/upload`,
    apiKey: KEY(),
    timestamp,
    publicId,
    signature: sign({ public_id: publicId, timestamp }),
  };
}

// The URL the client reports must be the Cloudinary asset for this user + cell
export function isOwnUpload(url, publicId, userId, cellId) {
  if (typeof url !== "string" || typeof publicId !== "string") return false;
  if (!publicId.startsWith(`bingo/${userId}/${cellId}_`)) return false;
  const prefix = `https://res.cloudinary.com/${CLOUD()}/image/upload/`;
  const escaped = publicId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return url.startsWith(prefix) && new RegExp(`/v\\d+/${escaped}\\.\\w+$`).test(url);
}
