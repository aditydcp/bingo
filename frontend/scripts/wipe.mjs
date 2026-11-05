// Wipes all game data: players' boards, marks, board history, records, profiles, their
// Supabase Auth accounts and every photo under bingo/ in Cloudinary.
// Kept: master_config (cell pool + event window) and admin accounts (unless --include-admins).
//
//   npm run wipe -- --yes                     (from frontend/, reads .env)
//   npm run wipe -- --yes --include-admins    also delete admin accounts
//   npm run wipe                              dry run: only shows what would be deleted
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--yes");
const includeAdmins = args.has("--include-admins");

const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Run from frontend/ with: npm run wipe`);
    process.exit(1);
  }
  return v;
};

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CLOUD = env("CLOUDINARY_CLOUD_NAME");
const cloudAuth =
  "Basic " +
  Buffer.from(`${env("CLOUDINARY_API_KEY")}:${env("CLOUDINARY_API_SECRET")}`).toString("base64");

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const TABLES = ["records", "board_history", "bingo_states", "boards", "profiles"];

async function countRows(table) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count;
}

async function listAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function cloudinary(method, query) {
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload?${new URLSearchParams(query)}`,
    { method, headers: { Authorization: cloudAuth } },
  );
  if (!res.ok) throw new Error(`Cloudinary ${method} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function countPhotos() {
  let total = 0;
  let cursor;
  do {
    const page = await cloudinary("GET", {
      prefix: "bingo/",
      max_results: "500",
      ...(cursor && { next_cursor: cursor }),
    });
    total += page.resources.length;
    cursor = page.next_cursor;
  } while (cursor);
  return total;
}

// Deletes up to 1000 per call; `partial` means more remain
async function deletePhotos() {
  let deleted = 0;
  for (;;) {
    const res = await cloudinary("DELETE", { prefix: "bingo/" });
    deleted += Object.values(res.deleted || {}).filter((s) => s === "deleted").length;
    if (!res.partial) return deleted;
  }
}

const adminIds = new Set(must(await db.from("admins").select("user_id")).map((a) => a.user_id));
const authUsers = await listAuthUsers();
const doomedUsers = authUsers.filter((u) => includeAdmins || !adminIds.has(u.id));

console.log(`Project: ${new URL(env("NEXT_PUBLIC_SUPABASE_URL")).host} · Cloudinary: ${CLOUD}`);
for (const t of TABLES) console.log(`  ${t.padEnd(14)} ${await countRows(t)} rows`);
console.log(
  `  auth users     ${doomedUsers.length} of ${authUsers.length}` +
    (includeAdmins ? "" : ` (keeping ${authUsers.length - doomedUsers.length} admin)`),
);
console.log(`  photos         ${await countPhotos()} in bingo/`);

if (!confirmed) {
  console.log("\nDry run. Re-run with --yes to delete all of the above.");
  process.exit(0);
}

for (const t of TABLES) {
  const key = t === "profiles" ? "id" : "user_id";
  must(await db.from(t).delete().not(key, "is", null));
}
for (const u of doomedUsers) {
  const { error } = await db.auth.admin.deleteUser(u.id);
  if (error) throw error;
}
const photos = await deletePhotos();

console.log(`\nDone: tables cleared, ${doomedUsers.length} auth users and ${photos} photos deleted.`);
