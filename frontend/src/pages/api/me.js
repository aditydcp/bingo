import { db, must, requireUser, route, HttpError } from "../../lib/server/route";

const MAX_ALIAS = 30;

export default route({
  // { profile | null, isGuest }
  GET: async (req, res) => {
    const user = await requireUser(req);
    const profile = must(
      await db().from("profiles").select("name").eq("id", user.id).maybeSingle(),
    );
    res.json({ profile, isGuest: !!user.is_anonymous });
  },

  // Body { name }: the player's alias, unique (case-insensitive) so leaderboards stay readable
  POST: async (req, res) => {
    const user = await requireUser(req);
    const name = String(req.body?.name || "").trim().replace(/\s+/g, " ").slice(0, MAX_ALIAS);
    if (!name) throw new HttpError(400, "alias required");
    const escaped = name.replace(/[\\%_]/g, "\\$&");
    const taken = must(
      await db().from("profiles").select("id").ilike("name", escaped).neq("id", user.id).limit(1),
    );
    if (taken.length) throw new HttpError(409, "alias_taken");
    must(
      await db()
        .from("profiles")
        .upsert({ id: user.id, name, updated_at: new Date().toISOString() }),
    );
    res.json({ profile: { name } });
  },
});
