import { buildBoard } from "../../lib/bingo";
import { requireUser, route } from "../../lib/server/route";
import {
  getCells,
  getConfig,
  getOrCreateBoard,
  getRecords,
  publicRecords,
  requireProfile,
} from "../../lib/server/game";

// The player's board, marks, records and the event window. Deals a random board on first load.
export default route({
  GET: async (req, res) => {
    const user = await requireUser(req);
    const profile = await requireProfile(user.id);
    const config = await getConfig();
    const board = await getOrCreateBoard(user.id, config.masterCells);
    const [cells, records] = await Promise.all([getCells(user.id), getRecords(user.id)]);
    res.json({
      profile,
      isGuest: !!user.is_anonymous,
      board: buildBoard(board.positions, config.masterCells),
      round: board.round,
      cells,
      records: publicRecords(records),
      eventStart: config.eventStart,
      eventEnd: config.eventEnd,
      serverNow: new Date().toISOString(),
    });
  },
});
