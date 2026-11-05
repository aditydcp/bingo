// Player features: board dealing, photo upload, Bingo/full-board records, reroll, event window
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import state from "../../src/pages/api/state";
import cells from "../../src/pages/api/cells";
import signature from "../../src/pages/api/upload-signature";
import reroll from "../../src/pages/api/reroll";
import {
  COL0,
  PHOTO_POSITIONS,
  ROW0,
  call,
  cleanup,
  db,
  fakePhoto,
  getState,
  makeUser,
  mark,
  markAll,
  restoreConfig,
  saveConfig,
  setConfig,
  testPool,
  uniqueAlias,
  uploadToCloudinary,
} from "./helpers";

const player = () => makeUser({ alias: uniqueAlias("Player") });
const minutes = (n) => n * 60_000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
// Postgres returns "…+00:00", the app's own clock "…Z": compare instants
const ms = (t) => new Date(t).getTime();

beforeAll(saveConfig);
beforeEach(() => setConfig({ cells: testPool() }));
afterAll(async () => {
  await restoreConfig();
  await cleanup();
});

describe("GET /api/state — board dealing", () => {
  it("deals a 25-cell board with GARUT in the centre on first load", async () => {
    const s = await getState(await player());
    expect(s.round).toBe(1);
    expect(s.cells).toEqual({});
    expect(s.records).toEqual({ firstBingoAt: null, firstBingoRound: null, fullAt: null, fullRound: null });
    expect(s.board).toHaveLength(25);
    expect(s.board[12]).toEqual({ id: 12, cellId: 12, label: "GARUT", free: true });
    const ids = s.board.map((c) => c.cellId);
    expect(new Set(ids).size).toBe(25);
    s.board.forEach((c, i) => {
      expect(c.id).toBe(i);
      if (i !== 12) expect(c.label).toBe(`Test cell ${c.cellId}`);
    });
    expect(Math.abs(new Date(s.serverNow) - Date.now())).toBeLessThan(60_000);
  });

  it("keeps the same board on later loads", async () => {
    const u = await player();
    const a = await getState(u);
    const b = await getState(u);
    expect(b.board).toEqual(a.board);
  });

  it("deals only one board when the first loads race", async () => {
    const u = await player();
    const [a, b, c] = await Promise.all([getState(u), getState(u), getState(u)]);
    expect(b.board).toEqual(a.board);
    expect(c.board).toEqual(a.board);
  });

  it("applies the 'always' and 'group' rules from the master config", async () => {
    await setConfig({
      cells: testPool({ 6: { rule: "always" }, 20: { rule: "group" }, 21: { rule: "group" } }),
    });
    for (let i = 0; i < 5; i++) {
      const ids = (await getState(await player())).board.map((c) => c.cellId);
      expect(ids).toContain(6);
      expect(ids.includes(20) || ids.includes(21)).toBe(true);
    }
  });

  it("shows label edits on boards that were already dealt", async () => {
    const u = await player();
    const before = await getState(u);
    const cellId = before.board[0].cellId;
    await setConfig({
      cells: testPool().map((c) => (c.id === cellId ? { ...c, label: "Renamed label" } : c)),
    });
    expect((await getState(u)).board[0].label).toBe("Renamed label");
  });

  it("returns the event window", async () => {
    const start = iso(minutes(-5));
    const end = iso(minutes(60));
    await setConfig({ cells: testPool(), eventStart: start, eventEnd: end });
    const s = await getState(await player());
    expect(new Date(s.eventStart).getTime()).toBe(new Date(start).getTime());
    expect(new Date(s.eventEnd).getTime()).toBe(new Date(end).getTime());
  });
});

describe("photo upload", () => {
  it("full browser flow: signature → real Cloudinary upload → POST /api/cells", async () => {
    const u = await player();
    const s = await getState(u);
    const { sig, uploaded } = await uploadToCloudinary(u, 7);
    expect(sig.publicId).toMatch(new RegExp(`^bingo/${u.id}/${s.board[7].cellId}_\\d+$`));
    expect(uploaded.public_id).toBe(sig.publicId);

    const r = await call(cells, {
      method: "POST",
      token: u.token,
      body: { position: 7, photoUrl: uploaded.secure_url, publicId: uploaded.public_id },
    });
    expect(r.status).toBe(200);
    expect(r.body.cell).toMatchObject({
      marked: true,
      photoUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      cellId: s.board[7].cellId,
    });
    expect((await getState(u)).cells["7"].photoUrl).toBe(uploaded.secure_url);
    const head = await fetch(uploaded.secure_url, { method: "HEAD" });
    expect(head.ok).toBe(true);
  });

  it.each([12, -1, 25, "abc", undefined])("rejects position %s", async (position) => {
    const u = await player();
    await getState(u);
    for (const handler of [signature, cells]) {
      const r = await call(handler, { method: "POST", token: u.token, body: { position } });
      expect(r).toEqual({ status: 400, body: { error: "invalid position" } });
    }
  });

  it("rejects photos that aren't this player's upload for this cell", async () => {
    const u = await player();
    const other = await player();
    const { board } = await getState(u);
    const post = (body) => call(cells, { method: "POST", token: u.token, body: { position: 3, ...body } });

    expect((await post(fakePhoto(other, board[3].cellId))).status).toBe(400); // someone else's
    expect((await post(fakePhoto(u, board[4].cellId))).status).toBe(400); // another cell
    const own = fakePhoto(u, board[3].cellId);
    expect((await post({ ...own, photoUrl: own.photoUrl.replace("res.cloudinary.com", "evil.example") })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await getState(u)).cells).toEqual({});
  });

  it("replacing a photo keeps one entry with the newer photo", async () => {
    const u = await player();
    const first = await mark(u, 0);
    await new Promise((r) => setTimeout(r, 20));
    const second = await mark(u, 0);
    const s = await getState(u);
    expect(Object.keys(s.cells)).toEqual(["0"]);
    expect(s.cells["0"].photoUrl).toBe(second.body.cell.photoUrl);
    expect(ms(s.cells["0"].markedAt)).toBeGreaterThan(ms(first.body.cell.markedAt));
  });

  it("concurrent uploads to different cells all land", async () => {
    const u = await player();
    const { board } = await getState(u);
    const positions = [0, 1, 2, 3, 5, 6, 7, 8];
    const results = await Promise.all(positions.map((p) => mark(u, p, board)));
    results.forEach((r) => expect(r.status).toBe(200));
    expect(Object.keys((await getState(u)).cells).sort()).toEqual(positions.map(String).sort());
  });

  it("requires a profile", async () => {
    const u = await makeUser();
    expect((await call(signature, { method: "POST", token: u.token, body: { position: 0 } })).status).toBe(404);
    expect((await call(cells, { method: "POST", token: u.token, body: { position: 0 } })).status).toBe(404);
  });
});

describe("event window", () => {
  it("blocks uploads before the start", async () => {
    await setConfig({ cells: testPool(), eventStart: iso(minutes(30)) });
    const u = await player();
    const err = { status: 403, body: { error: "event_not_started" } };
    expect(await call(signature, { method: "POST", token: u.token, body: { position: 0 } })).toEqual(err);
    expect(await mark(u, 0)).toEqual(err);
  });

  it("blocks uploads after the end, but accepts in-flight photos within 2 minutes", async () => {
    await setConfig({ cells: testPool(), eventEnd: iso(minutes(-1)) });
    const u = await player();
    expect(await call(signature, { method: "POST", token: u.token, body: { position: 0 } })).toEqual({
      status: 403,
      body: { error: "event_closed" },
    });
    expect((await mark(u, 0)).status).toBe(200); // grace period

    await setConfig({ cells: testPool(), eventEnd: iso(minutes(-3)) });
    expect(await mark(u, 1)).toEqual({ status: 403, body: { error: "event_closed" } });
  });

  it("still lets players view and reroll outside the window", async () => {
    await setConfig({ cells: testPool(), eventEnd: iso(minutes(-10)) });
    const u = await player();
    expect((await call(state, { token: u.token })).status).toBe(200);
    expect((await call(reroll, { method: "POST", token: u.token })).status).toBe(200);
  });
});

describe("records", () => {
  it("records the first Bingo when a line completes, with a snapshot", async () => {
    const u = await player();
    const marks = await markAll(u, [0, 1, 2, 3]);
    expect(marks.at(-1).body.records.firstBingoAt).toBeNull();
    const done = await mark(u, 4);
    const rec = done.body.records;
    expect(ms(rec.firstBingoAt)).toBe(ms(done.body.cell.markedAt));
    expect(rec.firstBingoRound).toBe(1);
    expect(rec.fullAt).toBeNull();

    const { data } = await db.from("records").select("*").eq("user_id", u.id).single();
    expect(data.first_bingo_snapshot.round).toBe(1);
    expect(data.first_bingo_snapshot.lines).toEqual([ROW0]);
    expect(data.first_bingo_snapshot.board).toHaveLength(25);
    expect(Object.keys(data.first_bingo_snapshot.cells)).toHaveLength(5);
  });

  it("counts the free cell toward diagonals and its row/column", async () => {
    const u = await player();
    const r = await markAll(u, [0, 6, 18, 24]);
    expect(r.at(-1).body.records.firstBingoAt).not.toBeNull();
  });

  it("a second line does not change the first-Bingo time", async () => {
    const u = await player();
    const first = (await markAll(u, ROW0)).at(-1).body.records.firstBingoAt;
    const after = (await markAll(u, COL0.slice(1))).at(-1).body.records;
    expect(after.firstBingoAt).toBe(first);
  });

  it("replacing a photo in the only winning line moves the record later", async () => {
    const u = await player();
    const first = (await markAll(u, ROW0)).at(-1).body.records.firstBingoAt;
    await new Promise((r) => setTimeout(r, 20));
    const replaced = await mark(u, 2);
    expect(ms(replaced.body.records.firstBingoAt)).toBe(ms(replaced.body.cell.markedAt));
    expect(ms(replaced.body.records.firstBingoAt)).toBeGreaterThan(ms(first));
  });

  it("records a full board once all 24 photo cells are filled", async () => {
    const u = await player();
    const results = await markAll(u, PHOTO_POSITIONS);
    expect(results.at(-2).body.records.fullAt).toBeNull();
    const last = results.at(-1).body;
    expect(ms(last.records.fullAt)).toBe(ms(last.cell.markedAt));
    expect(last.records.fullRound).toBe(1);
    const { data } = await db.from("records").select("full_snapshot").eq("user_id", u.id).single();
    expect(Object.keys(data.full_snapshot.cells)).toHaveLength(24);
    expect((await getState(u)).records.fullAt).toBe(last.records.fullAt);
  });
});

describe("POST /api/reroll", () => {
  it("archives the old board, clears marks, deals a new board and bumps the round", async () => {
    const u = await player();
    const before = await getState(u);
    await markAll(u, [0, 1]);

    const r = await call(reroll, { method: "POST", token: u.token });
    expect(r.status).toBe(200);
    expect(r.body.round).toBe(2);
    expect(r.body.cells).toEqual({});
    expect(r.body.board).toHaveLength(25);
    expect(r.body.board[12].cellId).toBe(12);

    const after = await getState(u);
    expect(after.round).toBe(2);
    expect(after.cells).toEqual({});
    expect(after.board).toEqual(r.body.board);

    const { data: hist } = await db.from("board_history").select("*").eq("user_id", u.id);
    expect(hist).toHaveLength(1);
    expect(hist[0].round).toBe(1);
    expect(hist[0].positions).toEqual(before.board.map((c) => c.cellId));
    expect(Object.keys(hist[0].cells).sort()).toEqual(["0", "1"]);
  });

  it("can be repeated, keeping every old board", async () => {
    const u = await player();
    await getState(u);
    for (let i = 0; i < 3; i++) await call(reroll, { method: "POST", token: u.token });
    expect((await getState(u)).round).toBe(4);
    const { data } = await db.from("board_history").select("round").eq("user_id", u.id).order("round");
    expect(data.map((h) => h.round)).toEqual([1, 2, 3]);
  });

  it("works before the board was ever loaded", async () => {
    const u = await player();
    const r = await call(reroll, { method: "POST", token: u.token });
    expect(r.body.round).toBe(2);
  });

  it("keeps a record from a rerolled-away board final", async () => {
    const u = await player();
    const firstBingo = (await markAll(u, ROW0)).at(-1).body.records.firstBingoAt;
    await call(reroll, { method: "POST", token: u.token });

    const round2 = (await markAll(u, ROW0)).at(-1).body.records;
    expect(round2.firstBingoAt).toBe(firstBingo);
    expect(round2.firstBingoRound).toBe(1);

    const s = await getState(u);
    expect(s.round).toBe(2);
    expect(s.records.firstBingoRound).toBe(1);
  });

  it("a full board can still be earned on a later round", async () => {
    const u = await player();
    await markAll(u, ROW0);
    await call(reroll, { method: "POST", token: u.token });
    const last = (await markAll(u, PHOTO_POSITIONS)).at(-1).body.records;
    expect(last.firstBingoRound).toBe(1);
    expect(last.fullRound).toBe(2);
  });

  it("requires a profile", async () => {
    const u = await makeUser();
    expect((await call(reroll, { method: "POST", token: u.token })).status).toBe(404);
  });
});
