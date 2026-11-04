import { FREE_POS } from "../bingo";
import { db, must, HttpError } from "./route";

export async function getMasterCells() {
  const row = must(
    await db().from("master_config").select("cells").eq("id", 1).maybeSingle(),
  );
  return row?.cells || [];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 25 master cell IDs: 24 random non-FREE cells with FREE inserted at the centre
export function randomPositions(masterCells) {
  const free = masterCells.find((c) => c.label === "FREE") || { id: 12 };
  const picked = shuffle(masterCells.filter((c) => c.id !== free.id))
    .slice(0, 24)
    .map((c) => c.id);
  picked.splice(FREE_POS, 0, free.id);
  return picked;
}

export async function getOrCreatePositions(userId, masterCells) {
  const existing = must(
    await db().from("boards").select("positions").eq("user_id", userId).maybeSingle(),
  );
  if (existing) return existing.positions;
  // ignoreDuplicates: a concurrent first load may have inserted already; re-read below
  must(
    await db()
      .from("boards")
      .upsert(
        { user_id: userId, positions: randomPositions(masterCells) },
        { onConflict: "user_id", ignoreDuplicates: true },
      ),
  );
  const row = must(
    await db().from("boards").select("positions").eq("user_id", userId).single(),
  );
  return row.positions;
}

export async function getCells(userId) {
  const row = must(
    await db().from("bingo_states").select("cells").eq("user_id", userId).maybeSingle(),
  );
  return row?.cells || {};
}

export async function requireProfile(userId) {
  const profile = must(
    await db().from("profiles").select("name, entitas").eq("id", userId).maybeSingle(),
  );
  if (!profile) throw new HttpError(404, "profile_not_found");
  return profile;
}

export function parsePosition(value) {
  const pos = Number(value);
  if (!Number.isInteger(pos) || pos < 0 || pos > 24 || pos === FREE_POS) {
    throw new HttpError(400, "invalid position");
  }
  return pos;
}
