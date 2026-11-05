// Admin features: access control, master config, overview, export, player reset
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import adminMe from "../../src/pages/api/admin/me";
import config from "../../src/pages/api/admin/config";
import overview from "../../src/pages/api/admin/overview";
import exportData from "../../src/pages/api/admin/export";
import resetUser from "../../src/pages/api/admin/users/[id]";
import reroll from "../../src/pages/api/reroll";
import {
  ROW0,
  call,
  cleanup,
  db,
  getState,
  makeGuest,
  makeUser,
  markAll,
  restoreConfig,
  saveConfig,
  setConfig,
  testPool,
  uniqueAlias,
} from "./helpers";

let admin;
let player;

beforeAll(async () => {
  await saveConfig();
  admin = await makeUser({ admin: true });
  player = await makeUser({ alias: uniqueAlias("Player") });
});
beforeEach(() => setConfig({ cells: testPool() }));
afterAll(async () => {
  await restoreConfig();
  await cleanup();
});

const put = (body, token = admin.token) => call(config, { method: "PUT", token, body });

describe("access control", () => {
  const routes = [
    ["admin/me", adminMe, "GET"],
    ["admin/config GET", config, "GET"],
    ["admin/config PUT", config, "PUT"],
    ["admin/overview", overview, "GET"],
    ["admin/export", exportData, "GET"],
    ["admin/users/[id]", resetUser, "DELETE"],
  ];

  it.each(routes)("%s: 401 signed out, 403 for players", async (_, handler, method) => {
    expect((await call(handler, { method })).status).toBe(401);
    expect(await call(handler, { method, token: player.token, query: { id: player.id } })).toEqual({
      status: 403,
      body: { error: "forbidden" },
    });
  });

  it("admin/me answers admins", async () => {
    expect(await call(adminMe, { token: admin.token })).toEqual({
      status: 200,
      body: { email: admin.email },
    });
  });
});

describe("master config", () => {
  it("returns the pool and event window", async () => {
    const r = await call(config, { token: admin.token });
    expect(r.status).toBe(200);
    expect(r.body.masterCells).toEqual(testPool());
    expect(r.body).toMatchObject({ eventStart: null, eventEnd: null });
  });

  it("saves labels, rules and the event window; drops unknown fields", async () => {
    const cells = testPool({ 3: { rule: "always" }, 4: { rule: "group" } }).map((c) =>
      c.id === 5 ? { ...c, label: "Foto bareng Rangers", junk: "x", rule: null } : c,
    );
    const eventStart = "2026-06-01T01:00:00.000Z";
    const eventEnd = "2026-06-01T10:00:00.000Z";
    expect(await put({ cells, eventStart, eventEnd })).toEqual({ status: 200, body: { success: true } });

    const saved = (await call(config, { token: admin.token })).body;
    expect(saved.masterCells.find((c) => c.id === 3)).toEqual({ id: 3, label: "Test cell 3", rule: "always" });
    expect(saved.masterCells.find((c) => c.id === 4)).toEqual({ id: 4, label: "Test cell 4", rule: "group" });
    expect(saved.masterCells.find((c) => c.id === 5)).toEqual({ id: 5, label: "Foto bareng Rangers" });
    expect(saved.masterCells.find((c) => c.id === 12)).toEqual({ id: 12, label: "GARUT", free: true });
    expect(new Date(saved.eventStart).toISOString()).toBe(eventStart);
    expect(new Date(saved.eventEnd).toISOString()).toBe(eventEnd);
  });

  it("clears the event window with empty values", async () => {
    await setConfig({ cells: testPool(), eventStart: "2026-06-01T01:00:00Z" });
    await put({ cells: testPool(), eventStart: "", eventEnd: null });
    expect((await call(config, { token: admin.token })).body).toMatchObject({ eventStart: null, eventEnd: null });
  });

  it.each([
    ["missing cells", { cells: undefined }, "cells must be [{ id, label, rule? }]"],
    ["non-integer id", { cells: [{ id: "1", label: "a" }] }, "cells must be [{ id, label, rule? }]"],
    ["label too long", { cells: [{ id: 1, label: "x".repeat(201) }] }, "cells must be [{ id, label, rule? }]"],
    ["unknown rule", { cells: [{ id: 1, label: "a", rule: "sometimes" }] }, "cells must be [{ id, label, rule? }]"],
    ["bad time", { cells: [], eventStart: "not a date" }, "invalid event time"],
    [
      "end before start",
      { cells: [], eventStart: "2026-06-01T10:00:00Z", eventEnd: "2026-06-01T09:00:00Z" },
      "event end must be after start",
    ],
    [
      "more than 24 required cells",
      { cells: testPool(Object.fromEntries([...Array(26).keys()].map((i) => [i, { rule: "always" }]))) },
      "too many required cells for a 24-cell board",
    ],
    [
      "24 always + a group",
      {
        cells: testPool({
          ...Object.fromEntries([...Array(24).keys()].map((i) => [i === 12 ? 24 : i, { rule: "always" }])),
          25: { rule: "group" },
        }),
      },
      "too many required cells for a 24-cell board",
    ],
  ])("rejects %s", async (_, body, error) => {
    expect(await put(body)).toEqual({ status: 400, body: { error } });
    expect((await call(config, { token: admin.token })).body.masterCells).toEqual(testPool());
  });

  it("accepts exactly 24 required slots", async () => {
    const rules = Object.fromEntries([...Array(23).keys()].map((i) => [i === 12 ? 23 : i, { rule: "always" }]));
    rules[24] = { rule: "group" };
    rules[25] = { rule: "group" };
    expect((await put({ cells: testPool(rules) })).status).toBe(200);
  });
});

describe("overview + export", () => {
  it("lists players with alias, email, guest flag, board, marks and records", async () => {
    const guest = await makeGuest({ alias: uniqueAlias("Tamu") });
    await markAll(player, ROW0);

    const r = await call(overview, { token: admin.token });
    expect(r.status).toBe(200);
    const p = r.body.users[player.id];
    expect(p).toMatchObject({ id: player.id, email: player.email, isGuest: false });
    expect(p.name).toMatch(/^Player /);
    expect(p).not.toHaveProperty("entitas");
    expect(r.body.users[guest.id]).toMatchObject({ isGuest: true, email: null });
    expect(r.body.users[admin.id]).toBeUndefined(); // admin never made a profile

    expect(r.body.boards[player.id].positions).toHaveLength(25);
    expect(Object.keys(r.body.states[player.id].cells)).toHaveLength(5);
    expect(r.body.records[player.id].firstBingoAt).not.toBeNull();
    expect(r.body.records[player.id].firstBingoSnapshot.lines).toEqual([ROW0]);
    expect(r.body.masterCells).toEqual(testPool());
    expect(r.body.event).toEqual({ start: null, end: null });
  });

  it("export adds rerolled boards per player", async () => {
    const u = await makeUser({ alias: uniqueAlias("Reroller") });
    await markAll(u, [0]);
    await call(reroll, { method: "POST", token: u.token });
    await call(reroll, { method: "POST", token: u.token });

    const r = await call(exportData, { token: admin.token });
    expect(r.status).toBe(200);
    const hist = r.body.history[u.id];
    expect(hist.map((h) => h.round)).toEqual([1, 2]);
    expect(Object.keys(hist[0].cells)).toEqual(["0"]);
    expect(hist[0].positions).toHaveLength(25);
    expect(r.body.users[u.id]).toBeDefined();
  });
});

describe("reset player", () => {
  it("clears board, marks, history and records; a fresh board is dealt next time", async () => {
    const u = await makeUser({ alias: uniqueAlias("Resettable") });
    await markAll(u, ROW0);
    await call(reroll, { method: "POST", token: u.token });

    expect(await call(resetUser, { method: "DELETE", token: admin.token, query: { id: u.id } })).toEqual({
      status: 200,
      body: { success: true },
    });
    for (const table of ["boards", "bingo_states", "board_history", "records"]) {
      const { data } = await db.from(table).select("user_id").eq("user_id", u.id);
      expect(data, table).toEqual([]);
    }
    const { data: profile } = await db.from("profiles").select("name").eq("id", u.id).single();
    expect(profile.name).toMatch(/^Resettable /); // alias is kept

    const s = await getState(u);
    expect(s.round).toBe(1);
    expect(s.cells).toEqual({});
    expect(s.records.firstBingoAt).toBeNull();
  });
});
