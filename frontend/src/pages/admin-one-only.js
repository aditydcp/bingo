import { useState, useEffect } from "react";
import axios from "axios";
import Head from "next/head";
import Link from "next/link";

const API = "";
const FREE_POS = 12;
const LETTERS = ["F", "I", "R", "S", "T"];

function checkBingo(markedSet) {
  const has = (id) => markedSet.has(id);
  const lines = [];
  for (let r = 0; r < 5; r++) {
    const row = [0, 1, 2, 3, 4].map((c) => r * 5 + c);
    if (row.every(has)) lines.push(row);
  }
  for (let c = 0; c < 5; c++) {
    const col = [0, 1, 2, 3, 4].map((r) => r * 5 + c);
    if (col.every(has)) lines.push(col);
  }
  if ([0, 6, 12, 18, 24].every(has)) lines.push([0, 6, 12, 18, 24]);
  if ([4, 8, 12, 16, 20].every(has)) lines.push([4, 8, 12, 16, 20]);
  return lines;
}

// Build ordered board array from a positions array + master cell map
function buildBoard(positions, cellById) {
  if (!positions) return [];
  return positions.map((cellId, pos) => ({
    id: pos,
    cellId,
    label: cellById[cellId]?.label || "",
  }));
}

function MiniGrid({ cellStates }) {
  const markedSet = new Set(
    Object.entries(cellStates || {})
      .filter(([, v]) => v?.marked)
      .map(([k]) => Number(k)),
  );
  markedSet.add(FREE_POS);
  const winSet = new Set(checkBingo(markedSet).flat());

  return (
    <div className="mini-grid">
      {Array.from({ length: 25 }, (_, i) => (
        <div
          key={i}
          className={`mini-cell ${
            winSet.has(i)
              ? "winning"
              : i === FREE_POS
                ? "free"
                : markedSet.has(i)
                  ? "marked"
                  : ""
          }`}
        />
      ))}
    </div>
  );
}

// Photo detail popup shown inside the admin board modal
function PhotoPopup({ photo, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-card rounded-2xl overflow-hidden">
          <img
            src={photo.photoUrl}
            alt="Activity photo"
            className="w-full object-contain max-h-80"
          />
          <div className="p-4">
            <p className="text-white text-sm font-semibold">{photo.label}</p>
            {photo.markedAt && (
              <p className="text-blue-300 text-xs mt-1">
                {new Date(photo.markedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-blue-300 text-sm hover:text-white transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

function UserBingoModal({ user, state, board, onClose }) {
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const cellMap = state?.cells || {};
  const markedSet = new Set(
    Object.entries(cellMap)
      .filter(([, v]) => v?.marked)
      .map(([k]) => Number(k)),
  );
  markedSet.add(FREE_POS);
  const winLines = checkBingo(markedSet);
  const winSet = new Set(winLines.flat());

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="glass-card rounded-2xl w-full max-w-md my-4 fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">{user.name}</h2>
                <span className="badge badge-blue mt-1">{user.entitas}</span>
              </div>
              <button
                onClick={onClose}
                className="text-blue-400 hover:text-white text-xl leading-none mt-0.5"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <span className="text-xs text-blue-300">
                Bergabung:{" "}
                {new Date(user.registeredAt).toLocaleDateString("id-ID", {
                  dateStyle: "medium",
                })}
              </span>
              <span className="text-blue-500">·</span>
              <span className="text-xs text-blue-300">
                {markedSet.size}/25 sel
              </span>
              {winLines.length > 0 && (
                <>
                  <span className="text-blue-500">·</span>
                  <span className="text-xs text-yellow-300">
                    🏆 {winLines.length} Bingo
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Bingo grid */}
          <div className="p-4">
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {LETTERS.map((l) => (
                <div
                  key={l}
                  className="bingo-header-cell h-7 rounded-md text-xs"
                >
                  {l}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {board.map((cell) => {
                const pos = cell.id;
                const cs = cellMap[pos];
                const isMarked = !!cs?.marked;
                const isFree = pos === FREE_POS;
                const isWin = winSet.has(pos);
                const hasPhoto = !!cs?.photoUrl;

                return (
                  <div
                    key={pos}
                    className={`relative rounded-md overflow-hidden border transition-all ${hasPhoto ? "cursor-pointer hover:brightness-110 hover:scale-105" : ""}`}
                    style={{
                      aspectRatio: "1",
                      borderColor: isWin
                        ? "rgba(245,158,11,0.7)"
                        : isMarked
                          ? "rgba(0,200,255,0.3)"
                          : "rgba(0,100,255,0.15)",
                      background: isWin
                        ? "rgba(245,158,11,0.15)"
                        : isFree
                          ? "rgba(245,158,11,0.1)"
                          : isMarked
                            ? "rgba(0,100,255,0.2)"
                            : "rgba(0,20,60,0.4)",
                      boxShadow: isWin
                        ? "0 0 8px rgba(245,158,11,0.4)"
                        : "none",
                    }}
                    onClick={
                      hasPhoto
                        ? () =>
                            setPreviewPhoto({
                              photoUrl: `${API}${cs.photoUrl}`,
                              label: cell.label,
                              markedAt: cs.markedAt,
                            })
                        : undefined
                    }
                  >
                    {hasPhoto ? (
                      <>
                        <img
                          src={`${API}${cs.photoUrl}`}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Camera icon hint */}
                        <div className="absolute inset-0 flex items-end justify-end p-0.5">
                          <span className="text-[8px] bg-black/50 rounded px-0.5 text-white">
                            🔍
                          </span>
                        </div>
                        {isWin && (
                          <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                            <span
                              className="text-white"
                              style={{ fontSize: "6px" }}
                            >
                              ★
                            </span>
                          </div>
                        )}
                      </>
                    ) : isFree ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs">⭐</span>
                      </div>
                    ) : isMarked ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-green-400 text-sm">✓</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-0.5">
                        <p className="text-[6px] text-blue-300/60 text-center leading-tight">
                          {cell.label}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Photo cells hint */}
            {Object.values(cellMap).some((v) => v?.photoUrl) && (
              <p className="text-center text-blue-400/60 text-[10px] mt-2">
                Klik sel dengan foto 🔍 untuk melihat gambar
              </p>
            )}
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full glass-card rounded-xl py-2.5 text-blue-200 text-sm hover:text-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Photo detail popup (z-60, on top of the modal) */}
      {previewPhoto && (
        <PhotoPopup
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </>
  );
}

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [viewUser, setViewUser] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    try {
      const [overviewRes, configRes] = await Promise.all([
        axios.get(`${API}/api/admin/overview`),
        axios.get(`${API}/api/master/config`),
      ]);
      setData(overviewRes.data);
      setConfig(configRes.data);
      setLastRefresh(new Date());
    } catch {
      alert("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="grid-overlay" />
        <div className="relative z-10 text-center">
          <div className="spinner mb-4" />
          <p className="text-blue-300 text-sm">Memuat data admin...</p>
        </div>
      </div>
    );
  }

  const { users, states, boards, completions, masterCells } = data;

  // Build a lookup map: cell ID → cell object
  const cellById = {};
  (masterCells || config?.cells || []).forEach((c) => {
    cellById[c.id] = c;
  });

  const completionMap = {};
  completions.forEach((c) => {
    completionMap[c.userId] = c;
  });

  const allUsers = Object.values(users);
  const filteredUsers = allUsers.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.entitas.toLowerCase().includes(q);
    const ms = new Set(
      Object.entries(states[u.id]?.cells || {})
        .filter(([, v]) => v?.marked)
        .map(([k]) => Number(k)),
    );
    ms.add(FREE_POS);
    const hasBingo = checkBingo(ms).length > 0;
    const isFinished = !!completionMap[u.id];
    if (tab === "bingo") return matchSearch && hasBingo;
    if (tab === "finished") return matchSearch && isFinished;
    return matchSearch;
  });

  filteredUsers.sort((a, b) => {
    const fa = completionMap[a.id],
      fb = completionMap[b.id];
    if (fa && fb) return new Date(fa.completedAt) - new Date(fb.completedAt);
    if (fa) return -1;
    if (fb) return 1;
    const msA = Object.values(states[a.id]?.cells || {}).filter(
      (v) => v?.marked,
    ).length;
    const msB = Object.values(states[b.id]?.cells || {}).filter(
      (v) => v?.marked,
    ).length;
    return msB - msA;
  });

  const totalBingo = allUsers.filter((u) => {
    const ms = new Set(
      Object.entries(states[u.id]?.cells || {})
        .filter(([, v]) => v?.marked)
        .map(([k]) => Number(k)),
    );
    ms.add(FREE_POS);
    return checkBingo(ms).length > 0;
  }).length;

  // Reconstruct the viewed user's personal board
  const viewUserBoard = viewUser
    ? buildBoard(
        boards[viewUser.id] || Array.from({ length: 25 }, (_, i) => i),
        cellById,
      )
    : null;

  return (
    <>
      <Head>
        <title>Admin — IDSurvey Bingo</title>
      </Head>
      <div className="bingo-bg min-h-screen">
        <div className="grid-overlay" />

        {/* Navbar */}
        <nav className="navbar relative z-10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-blue-400 hover:text-white transition-colors text-sm"
            >
              ← Beranda
            </Link>
            <span className="text-white font-bold text-sm">
              Admin Dashboard
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/master-admin-gweh"
              className="text-xs text-blue-300 hover:text-white px-3 py-1.5 glass-card rounded-lg transition-colors"
            >
              Master Panel
            </Link>
            <button
              onClick={loadData}
              className="text-xs text-blue-300 hover:text-white px-3 py-1.5 glass-card rounded-lg transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </nav>

        <div className="relative z-10 px-4 py-6 max-w-5xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: "Total Peserta",
                value: allUsers.length,
                icon: "👥",
                color: "blue",
              },
              {
                label: "Dapat Bingo",
                value: totalBingo,
                icon: "🏆",
                color: "gold",
              },
              {
                label: "Sudah Finish",
                value: completions.length,
                icon: "✅",
                color: "green",
              },
              {
                label: "Sedang Bermain",
                value: allUsers.length - completions.length,
                icon: "🎯",
                color: "blue",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="glass-card rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-white font-black text-2xl">{s.value}</div>
                <div className="text-blue-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Completions highlight */}
          {completions.length > 0 && (
            <div className="glass-card rounded-2xl p-5 mb-6 border border-yellow-500/20">
              <h2 className="text-yellow-300 font-bold text-sm mb-3 flex items-center gap-2">
                <span>🏆</span> Pemenang Bingo
              </h2>
              <div className="space-y-2">
                {completions
                  .sort(
                    (a, b) => new Date(a.completedAt) - new Date(b.completedAt),
                  )
                  .map((c, i) => (
                    <div
                      key={c.userId}
                      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          background:
                            i === 0
                              ? "#f59e0b"
                              : i === 1
                                ? "#94a3b8"
                                : i === 2
                                  ? "#cd7f32"
                                  : "rgba(0,100,255,0.3)",
                          color: "white",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {c.user?.name}
                        </p>
                        <p className="text-blue-300 text-xs">
                          {c.user?.entitas}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-300 text-xs font-mono">
                          {new Date(c.completedAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                        <p className="text-blue-400 text-[10px]">
                          {new Date(c.completedAt).toLocaleDateString("id-ID", {
                            dateStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Search + tabs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau entitas..."
              className="glass-input rounded-xl px-4 py-2.5 text-white text-sm flex-1"
            />
            <div className="flex gap-1 glass-card rounded-xl p-1">
              {[
                { key: "all", label: `Semua (${allUsers.length})` },
                { key: "bingo", label: `Bingo (${totalBingo})` },
                { key: "finished", label: `Finish (${completions.length})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === t.key
                      ? "bg-blue-600 text-white"
                      : "text-blue-300 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users table */}
          <div className="glass-card rounded-2xl overflow-hidden mb-4">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-blue-300 text-sm">
                Tidak ada data.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nama</th>
                      <th>Entitas</th>
                      <th>Progress</th>
                      <th>Mini Board</th>
                      <th>Status</th>
                      <th>Waktu Finish</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => {
                      const st = states[u.id]?.cells || {};
                      const markedSet = new Set(
                        Object.entries(st)
                          .filter(([, v]) => v?.marked)
                          .map(([k]) => Number(k)),
                      );
                      markedSet.add(FREE_POS);
                      const bingoLines = checkBingo(markedSet);
                      const hasBingo = bingoLines.length > 0;
                      const finished = !!completionMap[u.id];
                      const rank = completions
                        .sort(
                          (a, b) =>
                            new Date(a.completedAt) - new Date(b.completedAt),
                        )
                        .findIndex((c) => c.userId === u.id);

                      return (
                        <tr key={u.id}>
                          <td className="text-blue-400 font-mono text-xs">
                            {i + 1}
                          </td>
                          <td>
                            <div className="font-medium text-white text-sm">
                              {u.name}
                            </div>
                            <div className="text-blue-400/60 text-[10px]">
                              {new Date(u.registeredAt).toLocaleDateString(
                                "id-ID",
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-blue">
                              {u.entitas}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="progress-bar w-16">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${(markedSet.size / 25) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-blue-300 font-mono">
                                {markedSet.size}/25
                              </span>
                            </div>
                          </td>
                          <td>
                            <MiniGrid cellStates={st} />
                          </td>
                          <td>
                            {finished ? (
                              <span className="badge badge-green">
                                ✅ Finish
                              </span>
                            ) : hasBingo ? (
                              <span className="badge badge-gold">🏆 Bingo</span>
                            ) : (
                              <span className="badge badge-gray">Bermain</span>
                            )}
                          </td>
                          <td>
                            {completionMap[u.id] ? (
                              <div>
                                <div className="text-yellow-300 text-xs font-mono font-bold">
                                  #{rank + 1}
                                </div>
                                <div className="text-blue-300 text-[10px]">
                                  {new Date(
                                    completionMap[u.id].completedAt,
                                  ).toLocaleString("id-ID", {
                                    dateStyle: "short",
                                    timeStyle: "medium",
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-blue-400/40 text-xs">
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => setViewUser(u)}
                              className="text-xs text-blue-400 hover:text-white transition-colors px-2 py-1 glass-card rounded-lg"
                            >
                              Lihat
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {lastRefresh && (
            <p className="text-center text-blue-400/40 text-xs">
              Terakhir diperbarui: {lastRefresh.toLocaleTimeString("id-ID")} ·
              Auto-refresh setiap 30 detik
            </p>
          )}
        </div>

        {/* User detail modal with photo popup */}
        {viewUser && viewUserBoard && (
          <UserBingoModal
            user={viewUser}
            state={states[viewUser.id]}
            board={viewUserBoard}
            onClose={() => setViewUser(null)}
          />
        )}
      </div>
    </>
  );
}
