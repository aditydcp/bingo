import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { sign, uploadParams, isOwnUpload } from "../../src/lib/server/cloudinary";

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "testcloud";
  process.env.CLOUDINARY_API_KEY = "key123";
  process.env.CLOUDINARY_API_SECRET = "secret456";
});

const USER = "11111111-2222-3333-4444-555555555555";
const urlFor = (publicId, ext = "jpg") =>
  `https://res.cloudinary.com/testcloud/image/upload/v1712345678/${publicId}.${ext}`;

describe("sign", () => {
  it("is SHA-1 of the sorted params + secret (Cloudinary's scheme)", () => {
    const expected = crypto
      .createHash("sha1")
      .update("public_id=a/b&timestamp=10secret456")
      .digest("hex");
    expect(sign({ timestamp: 10, public_id: "a/b" })).toBe(expected);
  });
});

describe("uploadParams", () => {
  it("returns a signed upload for bingo/<user>/<cellId>_<timestamp>", () => {
    const p = uploadParams(USER, 7);
    expect(p.uploadUrl).toBe("https://api.cloudinary.com/v1_1/testcloud/image/upload");
    expect(p.apiKey).toBe("key123");
    expect(p.publicId).toBe(`bingo/${USER}/7_${p.timestamp}`);
    expect(Math.abs(p.timestamp - Date.now() / 1000)).toBeLessThan(5);
    expect(p.signature).toBe(sign({ public_id: p.publicId, timestamp: p.timestamp }));
  });
});

describe("isOwnUpload", () => {
  const id = `bingo/${USER}/7_1712345678`;

  it("accepts this user's upload for this cell", () => {
    expect(isOwnUpload(urlFor(id), id, USER, 7)).toBe(true);
    expect(isOwnUpload(urlFor(id, "png"), id, USER, 7)).toBe(true);
  });

  it("rejects another user's photo", () => {
    const other = `bingo/99999999-2222-3333-4444-555555555555/7_1712345678`;
    expect(isOwnUpload(urlFor(other), other, USER, 7)).toBe(false);
  });

  it("rejects a photo uploaded for another cell (incl. prefix lookalikes)", () => {
    expect(isOwnUpload(urlFor(id), id, USER, 8)).toBe(false);
    const id17 = `bingo/${USER}/17_1712345678`;
    expect(isOwnUpload(urlFor(id17), id17, USER, 1)).toBe(false);
  });

  it("rejects a URL that doesn't match the public ID", () => {
    const other = `bingo/${USER}/7_999`;
    expect(isOwnUpload(urlFor(other), id, USER, 7)).toBe(false);
  });

  it("rejects other hosts and other Cloudinary accounts", () => {
    expect(isOwnUpload(`https://evil.example.com/image/upload/v1/${id}.jpg`, id, USER, 7)).toBe(false);
    expect(
      isOwnUpload(`https://res.cloudinary.com/othercloud/image/upload/v1/${id}.jpg`, id, USER, 7),
    ).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isOwnUpload(null, id, USER, 7)).toBe(false);
    expect(isOwnUpload(urlFor(id), undefined, USER, 7)).toBe(false);
    expect(isOwnUpload({}, {}, USER, 7)).toBe(false);
  });
});
