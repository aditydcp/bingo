import { db, must, requireAdmin, route } from "../../../lib/server/route";
import { getMasterCells } from "../../../lib/server/game";

export default route({
  GET: async (req, res) => {
    await requireAdmin(req);
    const [profiles, states, boards, completions, masterCells, authUsers] =
      await Promise.all([
        db().from("profiles").select("*").order("created_at").then(must),
        db().from("bingo_states").select("user_id, cells, updated_at").then(must),
        db().from("boards").select("user_id, positions").then(must),
        db()
          .from("completions")
          .select("user_id, completed_at")
          .order("completed_at")
          .then(must),
        getMasterCells(),
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
        entitas: p.entitas,
        registeredAt: p.created_at,
        email: authById[p.id]?.email || null,
        isGuest: !!authById[p.id]?.is_anonymous,
      };
    });

    const statesById = {};
    states.forEach((s) => {
      statesById[s.user_id] = { cells: s.cells, updatedAt: s.updated_at };
    });

    const boardsById = {};
    boards.forEach((b) => {
      boardsById[b.user_id] = b.positions;
    });

    res.json({
      users,
      states: statesById,
      boards: boardsById,
      completions: completions.map((c) => ({
        userId: c.user_id,
        completedAt: c.completed_at,
        user: users[c.user_id],
      })),
      masterCells,
    });
  },
});
