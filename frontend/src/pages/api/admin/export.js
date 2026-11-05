import { db, must, requireAdmin, route } from "../../../lib/server/route";
import { loadGame } from "../../../lib/server/admin";

// Everything the admin's browser needs to build the photo ZIP (photos are fetched from Cloudinary there)
export default route({
  GET: async (req, res) => {
    await requireAdmin(req);
    const [game, history] = await Promise.all([
      loadGame(),
      db()
        .from("board_history")
        .select("user_id, round, positions, cells, archived_at")
        .order("round")
        .then(must),
    ]);
    const historyById = {};
    history.forEach((h) => {
      (historyById[h.user_id] ||= []).push({
        round: h.round,
        positions: h.positions,
        cells: h.cells,
        archivedAt: h.archived_at,
      });
    });
    res.json({ ...game, history: historyById });
  },
});
