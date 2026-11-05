import { db, must, requireAdmin, route } from "../../../../lib/server/route";

// Reset a player: clears marks, records, board history and board (a new random board is
// dealt on next load). Their photos stay in Cloudinary.
export default route({
  DELETE: async (req, res) => {
    await requireAdmin(req);
    const userId = req.query.id;
    await Promise.all(
      ["bingo_states", "records", "board_history", "boards"].map((table) =>
        db().from(table).delete().eq("user_id", userId).then(must),
      ),
    );
    res.json({ success: true });
  },
});
