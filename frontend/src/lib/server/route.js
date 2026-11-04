import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client (service role key bypasses RLS).
let admin;
export function db() {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Throws on a Supabase error, otherwise returns data
export function must({ data, error }) {
  if (error) throw error;
  return data;
}

export async function requireUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "unauthorized");
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  return data.user;
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  const row = must(
    await db().from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  );
  if (!row) throw new HttpError(403, "forbidden");
  return user;
}

// Wrap per-method handlers with method dispatch and JSON error responses:
//   export default route({ GET: async (req, res) => {...} })
export function route(handlers) {
  return async (req, res) => {
    const handler = handlers[req.method];
    if (!handler) return res.status(405).json({ error: "method_not_allowed" });
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      res.status(err.status || 500).json({ error: err.message || "server_error" });
    }
  };
}
