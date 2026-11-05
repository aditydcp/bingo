import { describe, it, expect, vi, afterEach } from "vitest";
import { randomPositions, parsePosition, assertEventOpen } from "../../src/lib/server/game";
import { FREE_POS } from "../../src/lib/bingo";

const pool = (n, extra = {}) => [
  ...Array.from({ length: n }, (_, i) => ({ id: i < 12 ? i : i + 1, label: `Cell ${i}`, ...extra[i] })),
  { id: 12, label: "GARUT", free: true },
];
const RUNS = 500;

describe("randomPositions", () => {
  it("deals 24 distinct pool cells with the free cell at the centre", () => {
    const cells = pool(40);
    const ids = new Set(cells.map((c) => c.id));
    for (let i = 0; i < 50; i++) {
      const p = randomPositions(cells);
      expect(p).toHaveLength(25);
      expect(p[FREE_POS]).toBe(12);
      expect(new Set(p).size).toBe(25);
      p.forEach((id) => expect(ids.has(id)).toBe(true));
    }
  });

  it("uses the free cell's ID wherever it sits in the pool", () => {
    const cells = [{ id: 99, label: "GARUT", free: true }, ...pool(30).filter((c) => !c.free)];
    expect(randomPositions(cells)[FREE_POS]).toBe(99);
  });

  it("varies the board between deals", () => {
    const cells = pool(40);
    const boards = new Set(Array.from({ length: 20 }, () => randomPositions(cells).join()));
    expect(boards.size).toBeGreaterThan(15);
  });

  it("puts every 'always' cell on every board, at varying positions", () => {
    const cells = pool(40, { 3: { rule: "always" }, 30: { rule: "always" } });
    const alwaysIds = cells.filter((c) => c.rule === "always").map((c) => c.id);
    const spots = new Set();
    for (let i = 0; i < RUNS; i++) {
      const p = randomPositions(cells);
      alwaysIds.forEach((id) => expect(p).toContain(id));
      spots.add(p.indexOf(alwaysIds[0]));
    }
    expect(spots.size).toBeGreaterThan(10);
  });

  it("puts at least one 'group' cell on every board, and picks different ones", () => {
    const groupIdx = [5, 20, 35];
    const cells = pool(40, Object.fromEntries(groupIdx.map((i) => [i, { rule: "group" }])));
    const groupIds = cells.filter((c) => c.rule === "group").map((c) => c.id);
    const seen = new Set();
    for (let i = 0; i < RUNS; i++) {
      const p = randomPositions(cells);
      const present = groupIds.filter((id) => p.includes(id));
      expect(present.length).toBeGreaterThanOrEqual(1);
      present.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(groupIds.length);
  });

  it("combines always + group rules", () => {
    const cells = pool(40, { 0: { rule: "always" }, 1: { rule: "group" }, 2: { rule: "group" } });
    for (let i = 0; i < RUNS; i++) {
      const p = randomPositions(cells);
      expect(p).toContain(0);
      expect(p.includes(1) || p.includes(2)).toBe(true);
    }
  });

  it("still deals when 23 always + 1 group fill the board exactly", () => {
    const rules = Object.fromEntries([...Array(23).keys()].map((i) => [i, { rule: "always" }]));
    rules[30] = { rule: "group" };
    rules[31] = { rule: "group" };
    const cells = pool(40, rules);
    for (let i = 0; i < 50; i++) {
      const p = randomPositions(cells);
      cells.filter((c) => c.rule === "always").forEach((c) => expect(p).toContain(c.id));
      expect(p.includes(31) || p.includes(32)).toBe(true);
    }
  });

  it("ignores rules on the free cell", () => {
    const cells = pool(30);
    cells.find((c) => c.free).rule = "always";
    expect(randomPositions(cells).filter((id) => id === 12)).toHaveLength(1);
  });
});

describe("parsePosition", () => {
  it("accepts 0–24 except the free cell", () => {
    expect(parsePosition(0)).toBe(0);
    expect(parsePosition("24")).toBe(24);
  });
  it.each([12, -1, 25, 1.5, "x", "", " ", "1e1", null, undefined, false, []])("rejects %s with 400", (v) => {
    expect(() => parsePosition(v)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("assertEventOpen", () => {
  afterEach(() => vi.useRealTimers());
  const now = new Date("2026-01-01T12:00:00Z");
  const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString();

  it("allows uploads with no window, or inside it", () => {
    vi.useFakeTimers({ now });
    expect(() => assertEventOpen({ eventStart: null, eventEnd: null })).not.toThrow();
    expect(() => assertEventOpen({ eventStart: iso(-1000), eventEnd: iso(1000) })).not.toThrow();
  });

  it("rejects before the start", () => {
    vi.useFakeTimers({ now });
    expect(() => assertEventOpen({ eventStart: iso(1000), eventEnd: null })).toThrow(
      expect.objectContaining({ status: 403, message: "event_not_started" }),
    );
  });

  it("rejects after the end, with a 2-minute grace only when asked", () => {
    vi.useFakeTimers({ now });
    const ended = { eventStart: null, eventEnd: iso(-60_000) };
    expect(() => assertEventOpen(ended)).toThrow(expect.objectContaining({ message: "event_closed" }));
    expect(() => assertEventOpen(ended, { grace: true })).not.toThrow();
    expect(() => assertEventOpen({ eventStart: null, eventEnd: iso(-121_000) }, { grace: true })).toThrow(
      expect.objectContaining({ status: 403, message: "event_closed" }),
    );
  });
});
