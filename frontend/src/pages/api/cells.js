import { db, must, requireUser, route, HttpError } from "../../lib/server/route";
import {
  assertEventOpen,
  getConfig,
  getOrCreateBoard,
  parsePosition,
  publicRecords,
  requireProfile,
  updateRecords,
} from "../../lib/server/game";
import { isOwnUpload } from "../../lib/server/cloudinary";

// Record a photo that the browser has just uploaded to Cloudinary, then refresh records.
// A replaced photo is kept in Cloudinary: snapshots may still show it.
export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    await requireProfile(user.id);
    const config = await getConfig();
    assertEventOpen(config, { grace: true });
    const pos = parsePosition(req.body?.position);
    const { positions } = await getOrCreateBoard(user.id, config.masterCells);
    const cellId = positions[pos];
    const { photoUrl, publicId } = req.body || {};
    if (!isOwnUpload(photoUrl, publicId, user.id, cellId)) {
      throw new HttpError(400, "invalid photo");
    }

    const cell = {
      marked: true,
      photoUrl,
      publicId,
      cellId,
      markedAt: new Date().toISOString(),
    };
    must(
      await db().rpc("set_cell", { p_user_id: user.id, p_pos: String(pos), p_cell: cell }),
    );
    const records = await updateRecords(user.id);

    res.json({ cell, records: publicRecords(records) });
  },
});
