// Bad-signal handling: api() timeouts/retries and the upload queue's retry rules
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } }),
}));

const { api, isTransient } = await import("../../src/lib/supabase");
const { backoff, isPermanent, photoSizeForConnection } = await import("../../src/lib/uploadQueue");

const json = (status, body) => ({ ok: status < 400, status, statusText: "x", json: async () => body });

describe("api()", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the bearer token and JSON body", async () => {
    const fetch = vi.fn(async () => json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetch);
    expect(await api("/api/x", { method: "POST", body: { a: 1 } })).toEqual({ ok: 1 });
    const [, init] = fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBe('{"a":1}');
  });

  it("retries a GET after a network failure, then succeeds", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(503, { error: "busy" }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetch);
    const p = api("/api/state");
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retries with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const p = api("/api/state").catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toMatchObject({ message: "network", status: 0 });
  });

  it("does not retry POSTs unless asked (reroll must not run twice)", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    const p = api("/api/reroll", { method: "POST" }).catch((e) => e);
    await vi.runAllTimersAsync();
    await p;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry client errors", async () => {
    const fetch = vi.fn(async () => json(409, { error: "alias_taken" }));
    vi.stubGlobal("fetch", fetch);
    const p = api("/api/me", { method: "POST", retries: 3 }).catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await p).toMatchObject({ message: "alias_taken", status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts a hanging request after the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_, { signal }) =>
          new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted")))),
      ),
    );
    const p = api("/api/x", { method: "POST", timeout: 5000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toMatchObject({ message: "timeout", status: 0 });
  });
});

describe("retry rules", () => {
  it("treats no response, 5xx, 408 and 429 as transient", () => {
    [0, undefined, 500, 503, 408, 429].forEach((status) => expect(isTransient({ status })).toBe(true));
    [400, 401, 403, 404, 409].forEach((status) => expect(isTransient({ status })).toBe(false));
  });

  it("drops a photo on cancel, closed event or invalid request; keeps retrying bad signal", () => {
    expect(isPermanent({ aborted: true, status: 0 }, 1)).toBe(true);
    expect(isPermanent({ status: 403, message: "event_closed" }, 1)).toBe(true);
    expect(isPermanent({ status: 400, message: "invalid photo" }, 1)).toBe(true);
    expect(isPermanent({ status: 0, message: "network" }, 50)).toBe(false);
    expect(isPermanent({ status: 0, message: "timeout" }, 50)).toBe(false);
    expect(isPermanent({ status: 502 }, 50)).toBe(false);
  });

  it("gives a Cloudinary rejection 3 tries (fresh signature each time) before dropping", () => {
    const err = { status: 400, cloudinary: true };
    expect(isPermanent(err, 1)).toBe(false);
    expect(isPermanent(err, 2)).toBe(false);
    expect(isPermanent(err, 3)).toBe(true);
    expect(isPermanent({ status: 500, cloudinary: true }, 9)).toBe(false);
  });

  it("backs off 2s, 4s, 8s … up to 30s", () => {
    expect([1, 2, 3, 4, 5, 10].map(backoff)).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe("photoSizeForConnection", () => {
  afterEach(() => vi.unstubAllGlobals());
  const withConnection = (connection) => vi.stubGlobal("navigator", { connection });

  it("uses full size when the connection is unknown or fast", () => {
    withConnection(undefined);
    expect(photoSizeForConnection()).toEqual({ maxSide: 1280, quality: 0.8 });
    withConnection({ effectiveType: "4g" });
    expect(photoSizeForConnection().maxSide).toBe(1280);
  });

  it("shrinks photos on 3G, 2G or data saver", () => {
    withConnection({ effectiveType: "3g" });
    expect(photoSizeForConnection().maxSide).toBe(1120);
    withConnection({ effectiveType: "2g" });
    expect(photoSizeForConnection()).toEqual({ maxSide: 960, quality: 0.7 });
    withConnection({ effectiveType: "4g", saveData: true });
    expect(photoSizeForConnection().maxSide).toBe(960);
  });
});
