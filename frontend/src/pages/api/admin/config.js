import { db, must, requireAdmin, route, HttpError } from "../../../lib/server/route";
import { getConfig } from "../../../lib/server/game";
import { requiredCount } from "../../../lib/bingo";

const RULES = ["always", "group"];

const parseTime = (value) => {
  if (value == null || value === "") return null;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) throw new HttpError(400, "invalid event time");
  return t.toISOString();
};

// Master cell pool + event window. Label edits apply to existing boards too, since boards store cell IDs.
export default route({
  GET: async (req, res) => {
    await requireAdmin(req);
    res.json(await getConfig());
  },

  PUT: async (req, res) => {
    await requireAdmin(req);
    const { cells, eventStart, eventEnd } = req.body || {};
    const valid =
      Array.isArray(cells) &&
      cells.every(
        (c) =>
          Number.isInteger(c?.id) &&
          typeof c?.label === "string" &&
          c.label.length <= 200 &&
          (c.rule == null || RULES.includes(c.rule)),
      );
    if (!valid) throw new HttpError(400, "cells must be [{ id, label, rule? }]");
    if (requiredCount(cells) > 24) {
      throw new HttpError(400, "too many required cells for a 24-cell board");
    }
    const start = parseTime(eventStart);
    const end = parseTime(eventEnd);
    if (start && end && start >= end) {
      throw new HttpError(400, "event end must be after start");
    }
    must(
      await db()
        .from("master_config")
        .upsert({
          id: 1,
          cells: cells.map(({ id, label, free, rule }) =>
            free ? { id, label, free: true } : rule ? { id, label, rule } : { id, label },
          ),
          event_start: start,
          event_end: end,
          updated_at: new Date().toISOString(),
        }),
    );
    res.json({ success: true });
  },
});
