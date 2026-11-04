import { requireAdmin, route } from "../../../lib/server/route";
import { loadGame } from "../../../lib/server/admin";

export default route({
  GET: async (req, res) => {
    await requireAdmin(req);
    res.json(await loadGame());
  },
});
