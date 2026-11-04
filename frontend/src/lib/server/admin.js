import { db, must } from "./route";
import { getConfig } from "./game";

// Users in a JSON-friendly map keyed by ID, with email + guest flag from auth
export async function loadUsers() {
  const [profiles, authUsers] = await Promise.all([
    db().from("profiles").select("*").order("created_at").then(must),
    db()
      .auth.admin.listUsers({ perPage: 1000 })
      .then(({ data, error }) => {
        if (error) throw error;
        return data.users;
      }),
  ]);
  const authById = {};
  authUsers.forEach((u) => {
    authById[u.id] = u;
  });
  const users = {};
  profiles.forEach((p) => {
    users[p.id] = {
      id: p.id,
      name: p.name,
      registeredAt: p.created_at,
      email: authById[p.id]?.email || null,
      isGuest: !!authById[p.id]?.is_anonymous,
    };
  });
  return users;
}

export async function loadGame() {
  const [users, states, boards, records, config] = await Promise.all([
    loadUsers(),
    db().from("bingo_states").select("user_id, cells, updated_at").then(must),
    db().from("boards").select("user_id, positions, round").then(must),
    db().from("records").select("*").then(must),
    getConfig(),
  ]);

  const statesById = {};
  states.forEach((s) => {
    statesById[s.user_id] = { cells: s.cells, updatedAt: s.updated_at };
  });
  const boardsById = {};
  boards.forEach((b) => {
    boardsById[b.user_id] = { positions: b.positions, round: b.round };
  });
  const recordsById = {};
  records.forEach((r) => {
    recordsById[r.user_id] = {
      firstBingoAt: r.first_bingo_at,
      firstBingoRound: r.first_bingo_round,
      firstBingoSnapshot: r.first_bingo_snapshot,
      fullAt: r.full_at,
      fullRound: r.full_round,
      fullSnapshot: r.full_snapshot,
    };
  });

  return {
    users,
    states: statesById,
    boards: boardsById,
    records: recordsById,
    masterCells: config.masterCells,
    event: { start: config.eventStart, end: config.eventEnd },
  };
}
