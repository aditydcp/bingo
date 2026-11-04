import { db, must, requireUser, route, HttpError } from "../../lib/server/route";
import { getCells, parsePosition, requireProfile } from "../../lib/server/game";
import { destroy, isOwnUpload } from "../../lib/server/cloudinary";

// Record a photo that the browser has just uploaded to Cloudinary
export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    await requireProfile(user.id);
    const pos = parsePosition(req.body?.position);
    const { photoUrl, publicId } = req.body || {};
    if (!isOwnUpload(photoUrl, publicId, user.id, pos)) {
      throw new HttpError(400, "invalid photo");
    }

    const previous = (await getCells(user.id))[pos]?.publicId;
    const cell = {
      marked: true,
      photoUrl,
      publicId,
      markedAt: new Date().toISOString(),
    };
    must(
      await db().rpc("set_cell", { p_user_id: user.id, p_pos: String(pos), p_cell: cell }),
    );
    if (previous && previous !== publicId) await destroy(previous);

    res.json({ cell });
  },
});
