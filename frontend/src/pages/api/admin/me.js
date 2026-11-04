import { requireAdmin, route } from "../../../lib/server/route";

// 200 for admins, 401/403 otherwise — used by the admin pages' gate
export default route({
  GET: async (req, res) => {
    const user = await requireAdmin(req);
    res.json({ email: user.email });
  },
});
