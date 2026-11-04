import { checkBingo, markedSetFrom } from "../../lib/bingo";
import { db, must, requireUser, route, HttpError } from "../../lib/server/route";
import { getCells, requireProfile } from "../../lib/server/game";

// Record the player's finish time. The first finish wins; later calls return it unchanged.
export default route({
  POST: async (req, res) => {
    const user = await requireUser(req);
    await requireProfile(user.id);
    const cells = await getCells(user.id);
    if (checkBingo(markedSetFrom(cells)).length === 0) {
      throw new HttpError(400, "no bingo yet");
    }
    must(
      await db()
        .from("completions")
        .upsert(
          { user_id: user.id, state_snapshot: cells },
          { onConflict: "user_id", ignoreDuplicates: true },
        ),
    );
    const row = must(
      await db()
        .from("completions")
        .select("completed_at")
        .eq("user_id", user.id)
        .single(),
    );
    res.json({ completedAt: row.completed_at });
  },
});
