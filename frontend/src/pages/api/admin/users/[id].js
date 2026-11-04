import { db, must, requireAdmin, route } from "../../../../lib/server/route";
import { destroyUserPhotos } from "../../../../lib/server/cloudinary";

// Reset a player: clears marks, finish and board (a new random board is dealt on next load)
export default route({
  DELETE: async (req, res) => {
    await requireAdmin(req);
    const userId = req.query.id;
    await Promise.all(
      ["bingo_states", "completions", "boards"].map((table) =>
        db().from(table).delete().eq("user_id", userId).then(must),
      ),
    );
    await destroyUserPhotos(userId);
    res.json({ success: true });
  },
});
