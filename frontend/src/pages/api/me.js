import { ENTITIES } from "../../lib/bingo";
import { db, must, requireUser, route, HttpError } from "../../lib/server/route";

export default route({
  // { profile | null, isGuest, suggestedName }
  GET: async (req, res) => {
    const user = await requireUser(req);
    const profile = must(
      await db().from("profiles").select("name, entitas").eq("id", user.id).maybeSingle(),
    );
    res.json({
      profile,
      isGuest: !!user.is_anonymous,
      suggestedName: user.user_metadata?.full_name || user.user_metadata?.name || "",
    });
  },

  POST: async (req, res) => {
    const user = await requireUser(req);
    const name = String(req.body?.name || "").trim().slice(0, 100);
    const entitas = req.body?.entitas;
    if (!name || !ENTITIES.includes(entitas)) {
      throw new HttpError(400, "name and entitas required");
    }
    must(
      await db()
        .from("profiles")
        .upsert({ id: user.id, name, entitas, updated_at: new Date().toISOString() }),
    );
    res.json({ profile: { name, entitas } });
  },
});
