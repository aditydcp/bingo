import { requireUser, route } from "../../lib/server/route";
import {
  assertEventOpen,
  getConfig,
  getOrCreateBoard,
  parsePosition,
  requireProfile,
} from "../../lib/server/game";
import { uploadParams } from "../../lib/server/cloudinary";

// Signed params for uploading one cell photo straight from the browser to Cloudinary
export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    await requireProfile(user.id);
    const config = await getConfig();
    assertEventOpen(config);
    const pos = parsePosition(req.body?.position);
    const { positions } = await getOrCreateBoard(user.id, config.masterCells);
    res.json(uploadParams(user.id, positions[pos]));
  },
});
