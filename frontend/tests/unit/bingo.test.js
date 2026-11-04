import { describe, it, expect } from "vitest";
import {
  FREE_POS,
  LETTERS,
  LINES,
  isFreeCell,
  requiredCount,
  checkBingo,
  markedSetFrom,
  cellsToLine,
  lineTimes,
  computeRecords,
  buildBoard,
  freeLabel,
  eventStatus,
  photoVariant,
  thumb,
  fullPhoto,
} from "../../src/lib/bingo";

const at = (min) => new Date(Date.UTC(2026, 0, 1, 8, min)).toISOString();
// cells object with a photo at each position, markedAt = given minute (or position index)
const filled = (positions, minuteOf = (p) => p) =>
  Object.fromEntries(positions.map((p) => [p, { marked: true, markedAt: at(minuteOf(p)) }]));
const ROW0 = [0, 1, 2, 3, 4];
const ALL_PHOTO = [...Array(25).keys()].filter((p) => p !== FREE_POS);

describe("board constants", () => {
  it("has BINGO column letters and the free cell in the centre", () => {
    expect(LETTERS.join("")).toBe("BINGO");
    expect(FREE_POS).toBe(12);
  });

  it("has 12 winning lines of 5 distinct positions", () => {
    expect(LINES).toHaveLength(12);
    LINES.forEach((l) => expect(new Set(l).size).toBe(5));
    const keys = new Set(LINES.map((l) => [...l].sort((a, b) => a - b).join()));
    expect(keys.size).toBe(12);
    expect(LINES).toContainEqual([0, 6, 12, 18, 24]);
    expect(LINES).toContainEqual([4, 8, 12, 16, 20]);
    expect(LINES.filter((l) => l.includes(FREE_POS))).toHaveLength(4);
  });
});

describe("isFreeCell / requiredCount", () => {
  it("detects the free cell by flag, and the legacy FREE label", () => {
    expect(isFreeCell({ id: 12, label: "GARUT", free: true })).toBe(true);
    expect(isFreeCell({ id: 12, label: "FREE" })).toBe(true);
    expect(isFreeCell({ id: 1, label: "GARUT" })).toBe(false);
    expect(isFreeCell(null)).toBe(false);
  });

  it("counts always cells plus one slot for the group, ignoring the free cell", () => {
    const pool = [
      { id: 0, label: "a", rule: "always" },
      { id: 1, label: "b", rule: "always" },
      { id: 2, label: "c", rule: "group" },
      { id: 3, label: "d", rule: "group" },
      { id: 4, label: "e" },
      { id: 12, label: "GARUT", free: true, rule: "always" },
    ];
    expect(requiredCount(pool)).toBe(3);
    expect(requiredCount(pool.filter((c) => c.rule !== "group"))).toBe(2);
    expect(requiredCount([])).toBe(0);
  });
});

describe("markedSetFrom / checkBingo", () => {
  it("always counts the free cell and ignores unmarked entries", () => {
    const set = markedSetFrom({ 0: { marked: true }, 1: { marked: false }, 2: {} });
    expect([...set].sort((a, b) => a - b)).toEqual([0, FREE_POS]);
    expect(markedSetFrom(null).has(FREE_POS)).toBe(true);
  });

  it("finds no line on an empty board", () => {
    expect(checkBingo(markedSetFrom({}))).toEqual([]);
  });

  it("finds a row, a column and a diagonal (diagonal uses the free cell)", () => {
    expect(checkBingo(markedSetFrom(filled(ROW0)))).toEqual([ROW0]);
    expect(checkBingo(markedSetFrom(filled([1, 6, 11, 16, 21])))).toEqual([[1, 6, 11, 16, 21]]);
    expect(checkBingo(markedSetFrom(filled([0, 6, 18, 24])))).toEqual([[0, 6, 12, 18, 24]]);
  });

  it("does not count 4 of 5 cells", () => {
    expect(checkBingo(markedSetFrom(filled([0, 1, 2, 3])))).toEqual([]);
  });

  it("finds all 12 lines on a full board", () => {
    expect(checkBingo(markedSetFrom(filled(ALL_PHOTO)))).toHaveLength(12);
  });
});

describe("cellsToLine", () => {
  it("is 4 on an empty board (lines through the free cell)", () => {
    expect(cellsToLine({})).toBe(4);
  });
  it("counts down as a line fills, 0 at Bingo", () => {
    expect(cellsToLine(filled([0, 1, 2]))).toBe(2);
    expect(cellsToLine(filled([10, 11, 13]))).toBe(1);
    expect(cellsToLine(filled(ROW0))).toBe(0);
  });
});

describe("lineTimes / computeRecords", () => {
  it("returns nothing before a Bingo", () => {
    expect(lineTimes(filled([0, 1, 2, 3]))).toEqual([]);
    expect(computeRecords(filled([0, 1, 2, 3]))).toEqual({
      firstBingoAt: null,
      firstLines: [],
      fullAt: null,
    });
    expect(computeRecords(null).firstBingoAt).toBeNull();
  });

  it("times a line by its latest photo", () => {
    const cells = filled(ROW0, (p) => [5, 1, 9, 2, 3][p]);
    expect(lineTimes(cells)).toEqual([{ line: ROW0, at: at(9) }]);
  });

  it("first Bingo is the earliest completed line, not the first one listed", () => {
    // row 0 finished at minute 20, column 4 (shares cell 4) finished at minute 10
    const cells = {
      ...filled(ROW0, () => 20),
      ...filled([4, 9, 14, 19, 24], () => 10),
    };
    cells[4] = { marked: true, markedAt: at(5) };
    const rec = computeRecords(cells);
    expect(rec.firstBingoAt).toBe(at(10));
    expect(rec.firstLines).toEqual([[4, 9, 14, 19, 24]]);
  });

  it("reports every line completed at the same moment", () => {
    // a single photo at cell 0 completes row 0 and column 0 together
    const cells = { ...filled([1, 2, 3, 4, 5, 10, 15, 20], () => 1), 0: { marked: true, markedAt: at(7) } };
    const rec = computeRecords(cells);
    expect(rec.firstBingoAt).toBe(at(7));
    expect(rec.firstLines).toHaveLength(2);
  });

  it("replacing a photo in the only winning line moves the record later", () => {
    const cells = filled(ROW0, () => 1);
    expect(computeRecords(cells).firstBingoAt).toBe(at(1));
    cells[2] = { marked: true, markedAt: at(30) };
    expect(computeRecords(cells).firstBingoAt).toBe(at(30));
  });

  it("full board = latest photo once all 24 photo cells are marked", () => {
    const cells = filled(ALL_PHOTO);
    expect(computeRecords(cells).fullAt).toBe(at(24));
    delete cells[24];
    expect(computeRecords(cells).fullAt).toBeNull();
  });

  it("ignores a stray entry at the free position for the full-board count", () => {
    const cells = { ...filled(ALL_PHOTO.slice(1)), [FREE_POS]: { marked: true, markedAt: at(1) } };
    expect(computeRecords(cells).fullAt).toBeNull();
  });
});

describe("buildBoard / freeLabel", () => {
  const pool = [
    { id: 7, label: "Seven" },
    { id: 12, label: "GARUT", free: true },
  ];
  it("joins labels by cell ID in board order and flags the centre", () => {
    const positions = Array.from({ length: 25 }, (_, i) => (i === FREE_POS ? 12 : 7));
    const board = buildBoard(positions, pool);
    expect(board).toHaveLength(25);
    expect(board[0]).toEqual({ id: 0, cellId: 7, label: "Seven", free: false });
    expect(board[FREE_POS]).toEqual({ id: 12, cellId: 12, label: "GARUT", free: true });
    expect(freeLabel(board)).toBe("GARUT");
  });
  it("tolerates unknown IDs and missing input", () => {
    expect(buildBoard([99], pool)[0].label).toBe("");
    expect(buildBoard(null, pool)).toEqual([]);
    expect(freeLabel(null)).toBe("GARUT");
  });
});

describe("eventStatus", () => {
  const start = "2026-01-01T08:00:00Z";
  const end = "2026-01-01T17:00:00Z";
  it("is before / open / after around the window", () => {
    expect(eventStatus(start, end, "2026-01-01T07:59:59Z")).toBe("before");
    expect(eventStatus(start, end, "2026-01-01T08:00:00Z")).toBe("open");
    expect(eventStatus(start, end, "2026-01-01T17:00:00Z")).toBe("open");
    expect(eventStatus(start, end, "2026-01-01T17:00:01Z")).toBe("after");
  });
  it("treats a missing bound as unlimited", () => {
    expect(eventStatus(null, null, "2000-01-01")).toBe("open");
    expect(eventStatus(null, end, "2000-01-01")).toBe("open");
    expect(eventStatus(start, null, "2099-01-01")).toBe("open");
  });
});

describe("Cloudinary URL variants", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v1/bingo/u/3_1.jpg";
  it("inserts the transformation after /image/upload/", () => {
    expect(photoVariant(url, "w_10")).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_10/v1/bingo/u/3_1.jpg",
    );
    expect(thumb(url, 160)).toContain("/c_fill,w_160,h_160,q_auto,f_auto/");
    expect(fullPhoto(url)).toContain("/c_limit,w_1200,h_1200,q_auto,f_auto/");
  });
  it("passes empty URLs through", () => {
    expect(thumb(undefined)).toBeUndefined();
  });
});
