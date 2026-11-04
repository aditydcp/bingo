// Shared by pages and API routes.

export const FREE_POS = 12; // center of the 5×5 grid — always the free (GARUT) cell
export const LETTERS = ["B", "I", "N", "G", "O"];

// The 12 winning lines: 5 rows, 5 columns, 2 diagonals (board positions)
export const LINES = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export const isFreeCell = (cell) => !!cell && (cell.free || cell.label === "FREE");

// Board slots taken by dealing rules: every "always" cell plus one cell from the "group"
export function requiredCount(cells) {
  const pool = cells.filter((c) => !isFreeCell(c));
  return (
    pool.filter((c) => c.rule === "always").length +
    (pool.some((c) => c.rule === "group") ? 1 : 0)
  );
}

export function checkBingo(markedSet) {
  return LINES.filter((line) => line.every((pos) => markedSet.has(pos)));
}

// Set of marked board positions; the free cell always counts as marked
export function markedSetFrom(cells) {
  const set = new Set(
    Object.entries(cells || {})
      .filter(([, v]) => v?.marked)
      .map(([k]) => Number(k)),
  );
  set.add(FREE_POS);
  return set;
}

// Fewest cells still missing in any line (0 = has a Bingo)
export function cellsToLine(cells) {
  const marked = markedSetFrom(cells);
  return Math.min(...LINES.map((line) => line.filter((p) => !marked.has(p)).length));
}

// Completion time of each completed line = latest markedAt among its photo cells.
// Replacing a photo in a line moves that line's time later.
export function lineTimes(cells) {
  const marked = markedSetFrom(cells);
  return LINES.filter((line) => line.every((p) => marked.has(p))).map((line) => ({
    line,
    at: line
      .filter((p) => p !== FREE_POS)
      .map((p) => cells[p].markedAt)
      .sort()
      .at(-1),
  }));
}

// { firstBingoAt, firstLines, fullAt } for the current board (null when not reached)
export function computeRecords(cells) {
  const times = lineTimes(cells || {});
  const firstBingoAt = times.length ? times.map((t) => t.at).sort()[0] : null;
  const firstLines = times.filter((t) => t.at === firstBingoAt).map((t) => t.line);
  const photoCells = Object.entries(cells || {}).filter(
    ([k, v]) => Number(k) !== FREE_POS && v?.marked,
  );
  const fullAt =
    photoCells.length === 24 ? photoCells.map(([, v]) => v.markedAt).sort().at(-1) : null;
  return { firstBingoAt, firstLines, fullAt };
}

// Ordered board array from a positions array + master cells
export function buildBoard(positions, masterCells) {
  const cellById = {};
  (masterCells || []).forEach((c) => {
    cellById[c.id] = c;
  });
  return (positions || []).map((cellId, pos) => ({
    id: pos,
    cellId,
    label: cellById[cellId]?.label || "",
    free: pos === FREE_POS,
  }));
}

// Label shown on the centre cell
export function freeLabel(board) {
  return board?.[FREE_POS]?.label || "GARUT";
}

// Event window state at `now` (all ISO strings / Dates)
export function eventStatus(eventStart, eventEnd, now = new Date()) {
  const t = new Date(now).getTime();
  if (eventStart && t < new Date(eventStart).getTime()) return "before";
  if (eventEnd && t > new Date(eventEnd).getTime()) return "after";
  return "open";
}

// Cloudinary delivery URL with an on-the-fly transformation
export function photoVariant(url, transform) {
  if (!url) return url;
  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}
export const thumb = (url, size = 300) =>
  photoVariant(url, `c_fill,w_${size},h_${size},q_auto,f_auto`);
export const fullPhoto = (url) =>
  photoVariant(url, "c_limit,w_1200,h_1200,q_auto,f_auto");
