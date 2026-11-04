import { buildBoard } from "../../lib/bingo";
import { db, must, requireUser, route } from "../../lib/server/route";
import {
  getCells,
  getConfig,
  getOrCreateBoard,
  randomPositions,
  requireProfile,
} from "../../lib/server/game";

// Deal a new random board. The old board + marks move to board_history;
// records and Cloudinary photos are kept.
export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    await requireProfile(user.id);
    const { masterCells } = await getConfig();
    const current = await getOrCreateBoard(user.id, masterCells);
    const cells = await getCells(user.id);

    must(
      await db().from("board_history").upsert({
        user_id: user.id,
        round: current.round,
        positions: current.positions,
        cells,
      }),
    );
    must(await db().from("bingo_states").delete().eq("user_id", user.id));
    const positions = randomPositions(masterCells);
    const round = current.round + 1;
    must(
      await db()
        .from("boards")
        .update({ positions, round, created_at: new Date().toISOString() })
        .eq("user_id", user.id),
    );

    res.json({ board: buildBoard(positions, masterCells), round, cells: {} });
  },
});
