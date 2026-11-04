// Real-browser tests of the board page: reroll overlay, feedback toggles, and photo uploads
// on good, missing and flaky signal. Drives the installed Edge (E2E_BROWSER=chrome for Chrome).
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { chromium } from "playwright-core";
import { cleanup, db, makeUser, restoreConfig, saveConfig, setConfig, testPool, uniqueAlias } from "../integration/helpers";

const BASE = `http://localhost:${process.env.E2E_PORT}`;
const STORAGE_KEY = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
// 1×1 PNG, standing in for a camera photo
const PHOTO = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

let browser;
let context;
let page;
let user;

beforeAll(async () => {
  await saveConfig();
  await setConfig({ cells: testPool() });
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER === "chrome" ? "chrome" : "msedge" });
});
afterAll(async () => {
  await browser?.close();
  await restoreConfig();
  await cleanup();
});

// A fresh signed-in player with an alias, already on /bingo
beforeEach(async () => {
  user = await makeUser({ alias: uniqueAlias("E2E") });
  context = await browser.newContext({ viewport: { width: 400, height: 860 } });
  await context.addInitScript(([key, session]) => localStorage.setItem(key, session), [
    STORAGE_KEY,
    JSON.stringify(user.session),
  ]);
  page = await context.newPage();
  await page.goto(`${BASE}/bingo`);
  await page.locator(".bingo-cell").first().waitFor();
});
afterEach(() => context?.close());

const cell = (pos) => page.locator(".bingo-cell").nth(pos);
const takePhoto = async (pos) => {
  const chooser = page.waitForEvent("filechooser");
  await cell(pos).click();
  await (await chooser).setFiles(PHOTO);
};
const savedCells = async () =>
  (await db.from("bingo_states").select("cells").eq("user_id", user.id).maybeSingle()).data?.cells || {};
const pendingInStorage = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("piknik-bingo", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("pending", { keyPath: "key" });
        req.onsuccess = () => {
          const get = req.result.transaction("pending").objectStore("pending").count();
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );

describe("board", () => {
  it("shows the player's alias, B-I-N-G-O header and 25 cells", async () => {
    await expect(page.locator(".badge-gold").innerText()).resolves.toBe(
      (await db.from("profiles").select("name").eq("id", user.id).single()).data.name,
    );
    expect(await page.locator(".bingo-header-cell").allInnerTexts()).toEqual(["B", "I", "N", "G", "O"]);
    expect(await page.locator(".bingo-cell").count()).toBe(25);
    expect(await cell(12).innerText()).toContain("GARUT");
  });
});

describe("reroll", () => {
  it("mutes and locks the board with a spinner until the new board arrives", async () => {
    const before = await page.locator(".bingo-cell").allInnerTexts();
    let release;
    await page.route("**/api/reroll", async (route) => {
      await new Promise((r) => (release = r));
      await route.continue();
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Acak Ulang Papan/ }).click();

    const grid = page.locator(".bingo-grid");
    await page.getByText("Mengacak papan…").waitFor();
    expect(await grid.getAttribute("class")).toContain("board-busy");
    expect(await grid.getAttribute("aria-busy")).toBe("true");
    expect(await grid.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    expect(await page.getByRole("button", { name: /Mengacak/ }).isDisabled()).toBe(true);

    release();
    await page.getByText("Mengacak papan…").waitFor({ state: "detached" });
    expect(await grid.getAttribute("class")).not.toContain("board-busy");
    expect(await page.locator(".bingo-cell").allInnerTexts()).not.toEqual(before);
  });
});

describe("sound / vibration / music toggles", () => {
  it("toggle independently and are remembered after a reload", async () => {
    const sound = page.getByRole("button", { name: /Suara/ });
    const music = page.getByRole("button", { name: /Musik/ });
    const vibration = page.getByRole("button", { name: /Getar/ });
    expect(await sound.getAttribute("aria-pressed")).toBe("true");
    expect(await music.getAttribute("aria-pressed")).toBe("false");
    expect(await vibration.getAttribute("aria-pressed")).toBe("true"); // desktop Edge has navigator.vibrate

    await music.click();
    await sound.click();
    expect(await music.getAttribute("aria-pressed")).toBe("true");
    expect(await sound.getAttribute("aria-pressed")).toBe("false");
    expect(await vibration.getAttribute("aria-pressed")).toBe("true");

    await page.reload();
    await page.locator(".bingo-cell").first().waitFor();
    expect(await page.getByRole("button", { name: /Musik/ }).getAttribute("aria-pressed")).toBe("true");
    expect(await page.getByRole("button", { name: /Suara/ }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("photo upload", () => {
  it("good signal: shows progress on the cell, then the photo", async () => {
    await takePhoto(0);
    await cell(0).locator(".marked-overlay").waitFor({ timeout: 60_000 });
    expect(await cell(0).locator(".pending-overlay").count()).toBe(0);
    expect(await cell(0).locator("img").getAttribute("src")).toContain("res.cloudinary.com");
    expect((await savedCells())["0"].marked).toBe(true);
    expect(await pendingInStorage()).toBe(0);
  });

  it("no signal: keeps the photo on the phone and sends it when the signal returns", async () => {
    await context.setOffline(true);
    await takePhoto(1);
    await page.getByText("Tidak ada sinyal.").waitFor();
    await page.getByText(/1 foto tersimpan di HP/).waitFor();
    expect(await cell(1).locator(".pending-overlay").innerText()).toContain("offline");
    expect(await pendingInStorage()).toBe(1);
    expect(await savedCells()).toEqual({});

    await context.setOffline(false);
    await cell(1).locator(".marked-overlay").waitFor({ timeout: 60_000 });
    expect(await page.getByText("Tidak ada sinyal.").count()).toBe(0);
    expect((await savedCells())["1"].marked).toBe(true);
    expect(await pendingInStorage()).toBe(0);
  });

  it("flaky signal: retries failed uploads automatically", async () => {
    let failures = 2;
    await page.route("https://api.cloudinary.com/**", (route) =>
      failures-- > 0 ? route.abort("connectionreset") : route.continue(),
    );
    await takePhoto(2);
    await page.getByText("Sinyal lemah, mencoba mengirim lagi…").waitFor();
    await cell(2).locator(".marked-overlay").waitFor({ timeout: 60_000 });
    expect(failures).toBeLessThan(0);
    expect((await savedCells())["2"].marked).toBe(true);
  });

  it("an unsent photo survives a page reload and is sent afterwards", async () => {
    await page.route("https://api.cloudinary.com/**", (route) => route.abort("connectionreset"));
    await takePhoto(3);
    await cell(3).locator(".pending-overlay").waitFor();
    expect(await pendingInStorage()).toBe(1);

    await page.unroute("https://api.cloudinary.com/**");
    page.on("dialog", (d) => d.accept()); // "leave site?" while a photo is pending
    await page.reload();
    await cell(3).locator(".marked-overlay").waitFor({ timeout: 60_000 });
    expect((await savedCells())["3"].marked).toBe(true);
  });

  it("tapping a waiting photo can cancel it", async () => {
    await context.setOffline(true);
    await takePhoto(4);
    await cell(4).locator(".pending-overlay").waitFor();
    page.once("dialog", (d) => d.accept());
    await cell(4).click();
    await cell(4).locator(".pending-overlay").waitFor({ state: "detached" });
    expect(await pendingInStorage()).toBe(0);
    await context.setOffline(false);
  });

  it("rerolling cancels unsent photos", async () => {
    await context.setOffline(true);
    await takePhoto(5);
    await cell(5).locator(".pending-overlay").waitFor();
    await context.setOffline(false);
    await page.route("https://api.cloudinary.com/**", (route) => route.abort("connectionreset"));
    page.once("dialog", (d) => {
      expect(d.message()).toContain("1 foto yang belum terkirim akan dibatalkan");
      d.accept();
    });
    await page.getByRole("button", { name: /Acak Ulang Papan/ }).click();
    await page.getByRole("button", { name: /Acak Ulang Papan/ }).waitFor();
    expect(await page.locator(".pending-overlay").count()).toBe(0);
    expect(await pendingInStorage()).toBe(0);
  });
});

describe("bad signal on load", () => {
  it("shows a retry screen instead of logging the player out", async () => {
    await page.route("**/api/state", (route) => route.abort("connectionreset"));
    await page.reload();
    await page.getByText("Sinyal lemah").waitFor({ timeout: 30_000 });
    expect(page.url()).toContain("/bingo");

    await page.unroute("**/api/state");
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.locator(".bingo-cell").first().waitFor();
    expect(await page.locator(".bingo-cell").count()).toBe(25);
  });
});
