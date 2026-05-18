const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const Minio = require("minio");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

// ── MinIO ──────────────────────────────────────────────────────────────────

const MINIO_BUCKET = process.env.MINIO_BUCKET || "bingo-photos";

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin123",
});

async function initMinio() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET);
    await minioClient.setBucketPolicy(
      MINIO_BUCKET,
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
          },
        ],
      }),
    );
  }
  console.log(`MinIO bucket "${MINIO_BUCKET}" ready`);
}

// Proxy route — browser hits /uploads/:filename → backend fetches from MinIO
app.get("/uploads/:filename", async (req, res) => {
  try {
    const stat = await minioClient.statObject(
      MINIO_BUCKET,
      req.params.filename,
    );
    res.setHeader(
      "Content-Type",
      stat.metaData["content-type"] || "application/octet-stream",
    );
    const stream = await minioClient.getObject(
      MINIO_BUCKET,
      req.params.filename,
    );
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// ── Database ───────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://bingo:bingo_secret@localhost:5432/bingo",
});

// 30-cell pool — users each get a random 25 (FREE always at center position 12)
const DEFAULT_CELLS = [
  {
    id: 0,
    label: "Seseorang yang bertanya ke pemateri",
  },
  {
    id: 1,
    label: "Seseorang tertawa",
  },
  {
    id: 2,
    label: "VP IT ID Survey",
  },
  {
    id: 3,
    label: "Cari orang brewok di acara",
  },
  {
    id: 4,
    label: "Judul Presentasi di 1 slide",
  },
  {
    id: 5,
    label: "Podium Kahoot",
  },
  {
    id: 6,
    label: "Foto Spanic",
  },
  {
    id: 7,
    label: "Foto Dwiki",
  },
  {
    id: 8,
    label: "Peserta menggunakan virtual background FIRST Summit",
  },
  {
    id: 9,
    label: "VP IT BKI",
  },
  {
    id: 10,
    label: "VP IT Sucofindo",
  },
  {
    id: 11,
    label: "VP IT SI",
  },
  {
    id: 12,
    label: "FREE",
  },
  {
    id: 13,
    label: "Foto video safety induction",
  },
  {
    id: 14,
    label: "Seseorang bertepuk tangan",
  },
  {
    id: 15,
    label: "Foto bersama teman sebelah",
  },
  {
    id: 16,
    label: "Foto Selfie saat acara",
  },
  {
    id: 17,
    label: "Foto Pemateri kedua",
  },
  {
    id: 18,
    label: "Foto orang yang sedang merem di acara/zoom",
  },
  {
    id: 19,
    label: "Share di story social media",
  },
  {
    id: 20,
    label: "Foto orang yang sedang makan di acara",
  },
  {
    id: 21,
    label: "Tulisan ERP saat acara",
  },
  {
    id: 22,
    label: "Pembicara minum air di depan panggung",
  },
  {
    id: 23,
    label: "Tulisan cybersecurity saat acara",
  },
  {
    id: 24,
    label: "Mengisi form evaluasi",
  },
  { id: 25, label: "Foto cewek berambut panjang di acara" },
  { id: 26, label: "Foto Seseorang tidak sesuai dresscode" },
  {
    id: 27,
    label: "Presentasi di 1 slide yang sama selama lebih dari 10 menit",
  },
  { id: 28, label: "Foto orang dengan hpnya di acara" },
  { id: 29, label: "Foto orang memakai topi di acara" },
];

// Fisher-Yates shuffle (mutates array)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a random 25-cell board from the master pool.
// Returns an array of 25 cell IDs; FREE is always at index 12.
function assignRandomBoard(masterCells) {
  const freeCell = masterCells.find((c) => c.label === "FREE") || {
    id: 12,
    label: "FREE",
  };
  const nonFree = shuffle([...masterCells.filter((c) => c.id !== freeCell.id)]);
  const picked = nonFree.slice(0, 24).map((c) => c.id);
  picked.splice(12, 0, freeCell.id); // insert FREE at position 12
  return picked;
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           VARCHAR(36) PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      entitas      VARCHAR(100) NOT NULL,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_boards (
      user_id    VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      positions  JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bingo_states (
      user_id    VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cells      JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS master_config (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      cells      JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS completions (
      user_id        VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      completed_at   TIMESTAMPTZ DEFAULT NOW(),
      state_snapshot JSONB
    );
  `);

  // Seed master config; merge any new pool cells added to DEFAULT_CELLS
  const {
    rows: [existing],
  } = await pool.query("SELECT cells FROM master_config WHERE id = 1");
  if (!existing) {
    await pool.query("INSERT INTO master_config (id, cells) VALUES (1, $1)", [
      JSON.stringify(DEFAULT_CELLS),
    ]);
  } else {
    const existingIds = new Set(existing.cells.map((c) => c.id));
    const newCells = DEFAULT_CELLS.filter((c) => !existingIds.has(c.id));
    if (newCells.length > 0) {
      const merged = [...existing.cells, ...newCells];
      await pool.query(
        "UPDATE master_config SET cells = $1, updated_at = NOW() WHERE id = 1",
        [JSON.stringify(merged)],
      );
      console.log(`Added ${newCells.length} new pool cells to master config`);
    }
  }
}

async function connectWithRetry(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("Connected to PostgreSQL");
      return;
    } catch {
      console.log(`DB not ready, retrying in 2 s… (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Could not connect to PostgreSQL after multiple retries");
}

// ── Multer ─────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── Routes: users ──────────────────────────────────────────────────────────

app.post("/api/register", async (req, res) => {
  const { userId, name, entitas } = req.body;
  if (!name || !entitas)
    return res.status(400).json({ error: "name and entitas required" });

  const id = userId || uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, entitas)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = $2, entitas = $3, updated_at = NOW()
     RETURNING *`,
    [id, name, entitas],
  );
  res.json({ userId: id, user: rows[0] });
});

app.get("/api/users", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM users ORDER BY registered_at",
  );
  const map = {};
  rows.forEach((u) => {
    map[u.id] = u;
  });
  res.json(map);
});

// ── Routes: bingo state ────────────────────────────────────────────────────

// Returns { cells, board } where board is the user's personal 25-cell ordered array.
// Assigns a random board on first access.
app.get("/api/bingo-state/:userId", async (req, res) => {
  const userId = req.params.userId;

  // Get master config for board generation / label lookup
  const { rows: masterRows } = await pool.query(
    "SELECT cells FROM master_config WHERE id = 1",
  );
  const masterCells = masterRows[0]?.cells || DEFAULT_CELLS;
  const cellById = {};
  masterCells.forEach((c) => {
    cellById[c.id] = c;
  });

  // Ensure user exists before touching user_boards (FK guard)
  const { rows: userRows } = await pool.query(
    "SELECT id FROM users WHERE id = $1",
    [userId],
  );
  if (userRows.length === 0) {
    return res.status(404).json({ error: "user_not_found" });
  }

  // Get or create user board
  let { rows: boardRows } = await pool.query(
    "SELECT positions FROM user_boards WHERE user_id = $1",
    [userId],
  );

  let positions;
  if (boardRows.length === 0) {
    // Preserve existing marks by assigning sequential board for users with state
    const { rows: existingState } = await pool.query(
      "SELECT cells FROM bingo_states WHERE user_id = $1",
      [userId],
    );
    const hasExistingMarks =
      existingState.length > 0 &&
      Object.keys(existingState[0]?.cells || {}).length > 0;

    if (hasExistingMarks) {
      positions = Array.from({ length: 25 }, (_, i) => i);
    } else {
      positions = assignRandomBoard(masterCells);
    }
    await pool.query(
      "INSERT INTO user_boards (user_id, positions) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
      [userId, JSON.stringify(positions)],
    );
  } else {
    positions = boardRows[0].positions;
  }

  // Build board: array of {id: position, cellId, label}
  const board = positions.map((cellId, pos) => ({
    id: pos,
    cellId,
    label: cellById[cellId]?.label || "",
  }));

  // Get cell marks (keyed by position 0-24) and completion status together
  const [stateResult, completionResult] = await Promise.all([
    pool.query("SELECT cells FROM bingo_states WHERE user_id = $1", [userId]),
    pool.query("SELECT completed_at FROM completions WHERE user_id = $1", [
      userId,
    ]),
  ]);

  const completion = completionResult.rows[0]
    ? { completedAt: completionResult.rows[0].completed_at }
    : null;

  res.json({ cells: stateResult.rows[0]?.cells || {}, board, completion });
});

app.post("/api/bingo-state", async (req, res) => {
  const { userId, cells } = req.body;
  await pool.query(
    `INSERT INTO bingo_states (user_id, cells)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET cells = $2, updated_at = NOW()`,
    [userId, JSON.stringify(cells)],
  );
  res.json({ success: true });
});

// ── Routes: photo upload ───────────────────────────────────────────────────

// cellId here is the BOARD POSITION (0-24), used as the key in bingo_states.cells
app.post(
  "/api/upload/:userId/:cellId",
  upload.single("photo"),
  async (req, res) => {
    const { userId, cellId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filename = `${uuidv4()}${path.extname(req.file.originalname)}`;
    await minioClient.putObject(
      MINIO_BUCKET,
      filename,
      req.file.buffer,
      req.file.size,
      {
        "Content-Type": req.file.mimetype,
      },
    );
    const photoUrl = `/uploads/${filename}`;

    await pool.query(
      `INSERT INTO bingo_states (user_id, cells)
     VALUES ($1, jsonb_build_object($2::text, jsonb_build_object(
       'photoUrl', $3::text,
       'marked', true,
       'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
     )))
     ON CONFLICT (user_id) DO UPDATE
       SET cells = bingo_states.cells || jsonb_build_object($2::text, jsonb_build_object(
             'photoUrl', $3::text,
             'marked', true,
             'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           )),
           updated_at = NOW()`,
      [userId, cellId, photoUrl],
    );

    res.json({ success: true, photoUrl });
  },
);

// ── Routes: master config ──────────────────────────────────────────────────

app.get("/api/master/config", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT cells, updated_at FROM master_config WHERE id = 1",
  );
  res.json({
    cells: rows[0]?.cells || DEFAULT_CELLS,
    updatedAt: rows[0]?.updated_at,
  });
});

app.post("/api/master/config", async (req, res) => {
  const { cells } = req.body;
  if (!Array.isArray(cells))
    return res.status(400).json({ error: "cells must be an array" });
  await pool.query(
    `INSERT INTO master_config (id, cells) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET cells = $1, updated_at = NOW()`,
    [JSON.stringify(cells)],
  );
  res.json({ success: true });
});

// ── Routes: finish bingo ───────────────────────────────────────────────────

app.post("/api/finish", async (req, res) => {
  const { userId } = req.body;
  const { rows: stateRows } = await pool.query(
    "SELECT cells FROM bingo_states WHERE user_id = $1",
    [userId],
  );
  await pool.query(
    `INSERT INTO completions (user_id, completed_at, state_snapshot)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (user_id) DO UPDATE SET completed_at = NOW(), state_snapshot = $2`,
    [userId, JSON.stringify(stateRows[0]?.cells || {})],
  );
  const { rows } = await pool.query(
    "SELECT completed_at FROM completions WHERE user_id = $1",
    [userId],
  );
  res.json({ success: true, completedAt: rows[0].completed_at });
});

app.get("/api/completions", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.user_id AS "userId", c.completed_at AS "completedAt",
           c.state_snapshot AS state,
           u.name, u.entitas, u.registered_at AS "registeredAt"
    FROM completions c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.completed_at
  `);
  const result = rows.map((r) => ({
    userId: r.userId,
    completedAt: r.completedAt,
    state: { cells: r.state },
    user: { name: r.name, entitas: r.entitas, registeredAt: r.registeredAt },
  }));
  res.json(result);
});

// ── Routes: admin overview ────────────────────────────────────────────────

app.get("/api/admin/overview", async (req, res) => {
  const [usersRes, statesRes, completionsRes, boardsRes, masterRes] =
    await Promise.all([
      pool.query("SELECT * FROM users ORDER BY registered_at"),
      pool.query("SELECT user_id, cells, updated_at FROM bingo_states"),
      pool.query(`
      SELECT c.user_id, c.completed_at, c.state_snapshot,
             u.name, u.entitas, u.registered_at
      FROM completions c JOIN users u ON u.id = c.user_id
      ORDER BY c.completed_at
    `),
      pool.query("SELECT user_id, positions FROM user_boards"),
      pool.query("SELECT cells FROM master_config WHERE id = 1"),
    ]);

  const users = {};
  usersRes.rows.forEach((u) => {
    users[u.id] = u;
  });

  const states = {};
  statesRes.rows.forEach((s) => {
    states[s.user_id] = { cells: s.cells, updatedAt: s.updated_at };
  });

  const boards = {};
  boardsRes.rows.forEach((b) => {
    boards[b.user_id] = b.positions;
  });

  const completions = completionsRes.rows.map((r) => ({
    userId: r.user_id,
    completedAt: r.completed_at,
    state: { cells: r.state_snapshot },
    user: { name: r.name, entitas: r.entitas, registeredAt: r.registered_at },
  }));

  const masterCells = masterRes.rows[0]?.cells || DEFAULT_CELLS;

  res.json({ users, states, boards, completions, masterCells });
});

// Reset a user's bingo state (master only)
app.delete("/api/admin/user-state/:userId", async (req, res) => {
  await pool.query("DELETE FROM bingo_states WHERE user_id = $1", [
    req.params.userId,
  ]);
  await pool.query("DELETE FROM completions WHERE user_id = $1", [
    req.params.userId,
  ]);
  await pool.query("DELETE FROM user_boards WHERE user_id = $1", [
    req.params.userId,
  ]);
  res.json({ success: true });
});

// ── Boot ───────────────────────────────────────────────────────────────────

(async () => {
  await connectWithRetry();
  await initDB();
  await initMinio();
  app.listen(PORT, () =>
    console.log(`Bingo backend running on http://localhost:${PORT}`),
  );
})();
