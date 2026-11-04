import { FREE_POS, buildBoard, computeRecords, isFreeCell } from "../bingo";
import { db, must, HttpError } from "./route";

// Uploads that started before the event ended may still land within this window
const END_GRACE_MS = 2 * 60 * 1000;

export async function getConfig() {
  const row = must(
    await db()
      .from("master_config")
      .select("cells, event_start, event_end")
      .eq("id", 1)
      .maybeSingle(),
  );
  return {
    masterCells: row?.cells || [],
    eventStart: row?.event_start || null,
    eventEnd: row?.event_end || null,
  };
}

export async function getMasterCells() {
  return (await getConfig()).masterCells;
}

// Throws 403 unless photos may be submitted right now
export function assertEventOpen({ eventStart, eventEnd }, { grace = false } = {}) {
  const now = Date.now();
  if (eventStart && now < Date.parse(eventStart)) {
    throw new HttpError(403, "event_not_started");
  }
  if (eventEnd && now > Date.parse(eventEnd) + (grace ? END_GRACE_MS : 0)) {
    throw new HttpError(403, "event_closed");
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 25 master cell IDs: 24 random non-free cells with the free (GARUT) cell at the centre.
// Cells with rule "always" are on every board; at least one "group" cell is on every board.
export function randomPositions(masterCells) {
  const free = masterCells.find(isFreeCell) || { id: 12 };
  const pool = shuffle(masterCells.filter((c) => c.id !== free.id));
  const required = pool.filter((c) => c.rule === "always");
  const groupPick = pool.find((c) => c.rule === "group");
  if (groupPick) required.push(groupPick);
  const rest = pool.filter((c) => !required.includes(c));
  const picked = shuffle([...required, ...rest].slice(0, 24)).map((c) => c.id);
  picked.splice(FREE_POS, 0, free.id);
  return picked;
}

// { positions, round }, dealing a random board on first access
export async function getOrCreateBoard(userId, masterCells) {
  const existing = must(
    await db().from("boards").select("positions, round").eq("user_id", userId).maybeSingle(),
  );
  if (existing) return existing;
  // ignoreDuplicates: a concurrent first load may have inserted already; re-read below
  must(
    await db()
      .from("boards")
      .upsert(
        { user_id: userId, positions: randomPositions(masterCells), round: 1 },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
  );
  return must(
    await db().from("boards").select("positions, round").eq("user_id", userId).single(),
  );
}

export async function getCells(userId) {
  const row = must(
    await db().from("bingo_states").select("cells").eq("user_id", userId).maybeSingle(),
  );
  return row?.cells || {};
}

export async function getRecords(userId) {
  return must(await db().from("records").select("*").eq("user_id", userId).maybeSingle());
}

export async function requireProfile(userId) {
  const profile = must(
    await db().from("profiles").select("name, entitas").eq("id", userId).maybeSingle(),
  );
  if (!profile) throw new HttpError(404, "profile_not_found");
  return profile;
}

export function parsePosition(value) {
  // Number(null), Number("") and Number(false) are all 0, so only accept numbers / digit strings
  const pos = /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (!Number.isInteger(pos) || pos < 0 || pos > 24 || pos === FREE_POS) {
    throw new HttpError(400, "invalid position");
  }
  return pos;
}

// Recompute first-Bingo / full-board records from the current board.
// A record earned on an earlier (rerolled) board is final and never replaced.
export async function updateRecords(userId) {
  const [{ masterCells }, board, cells, existing] = await Promise.all([
    getConfig(),
    db().from("boards").select("positions, round").eq("user_id", userId).single().then(must),
    getCells(userId),
    getRecords(userId),
  ]);
  const { firstBingoAt, firstLines, fullAt } = computeRecords(cells);
  const boardCells = buildBoard(board.positions, masterCells);
  const snapshot = (lines) => ({ round: board.round, board: boardCells, cells, lines });
  const mayUpdate = (round) => round == null || round === board.round;

  const next = { user_id: userId, updated_at: new Date().toISOString() };
  if (firstBingoAt && mayUpdate(existing?.first_bingo_round)) {
    Object.assign(next, {
      first_bingo_at: firstBingoAt,
      first_bingo_round: board.round,
      first_bingo_snapshot: snapshot(firstLines),
    });
  }
  if (fullAt && mayUpdate(existing?.full_round)) {
    Object.assign(next, {
      full_at: fullAt,
      full_round: board.round,
      full_snapshot: snapshot([]),
    });
  }
  if (Object.keys(next).length === 2) return existing;
  return must(await db().from("records").upsert(next).select().single());
}

// Shape sent to clients
export function publicRecords(row) {
  return {
    firstBingoAt: row?.first_bingo_at || null,
    firstBingoRound: row?.first_bingo_round || null,
    fullAt: row?.full_at || null,
    fullRound: row?.full_round || null,
  };
}
