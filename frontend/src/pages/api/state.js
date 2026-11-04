import { buildBoard } from "../../lib/bingo";
import { db, must, requireUser, route } from "../../lib/server/route";
import {
  getCells,
  getMasterCells,
  getOrCreatePositions,
  requireProfile,
} from "../../lib/server/game";

// The player's board, marks and completion. Assigns a random board on first load.
export default route({
  GET: async (req, res) => {
    const user = await requireUser(req);
    const profile = await requireProfile(user.id);
    const masterCells = await getMasterCells();
    const positions = await getOrCreatePositions(user.id, masterCells);
    const [cells, completion] = await Promise.all([
      getCells(user.id),
      db()
        .from("completions")
        .select("completed_at")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(must),
    ]);
    res.json({
      profile,
      isGuest: !!user.is_anonymous,
      board: buildBoard(positions, masterCells),
      cells,
      completion: completion ? { completedAt: completion.completed_at } : null,
    });
  },
});
