import { db, must, requireAdmin, route, HttpError } from "../../../lib/server/route";
import { getMasterCells } from "../../../lib/server/game";

// Master cell pool. Label edits apply to existing boards too, since boards store cell IDs.
export default route({
  GET: async (req, res) => {
    await requireAdmin(req);
    res.json({ cells: await getMasterCells() });
  },

  PUT: async (req, res) => {
    await requireAdmin(req);
    const cells = req.body?.cells;
    const valid =
      Array.isArray(cells) &&
      cells.every(
        (c) => Number.isInteger(c?.id) && typeof c?.label === "string" && c.label.length <= 200,
      );
    if (!valid) throw new HttpError(400, "cells must be [{ id, label }]");
    must(
      await db()
        .from("master_config")
        .upsert({
          id: 1,
          cells: cells.map(({ id, label }) => ({ id, label })),
          updated_at: new Date().toISOString(),
        }),
    );
    res.json({ success: true });
  },
});
