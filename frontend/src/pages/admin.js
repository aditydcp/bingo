import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  FREE_POS,
  LETTERS,
  checkBingo,
  markedSetFrom,
  cellsToLine,
  buildBoard,
  eventStatus,
  thumb,
  fullPhoto,
} from "../lib/bingo";
import { api } from "../lib/supabase";
import AdminGate from "../components/AdminGate";

const fmtTime = (iso) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });

// "+1j 05m 12d" since the event start (or null without a start time)
function elapsed(iso, start) {
  if (!iso || !start) return null;
  const s = Math.max(0, Math.round((new Date(iso) - new Date(start)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return `+${h ? `${h}j ` : ""}${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}d`;
}

function MiniGrid({ cellStates }) {
  const markedSet = markedSetFrom(cellStates);
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
      className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[60] p-4"
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
            <p className="text-slate-800 text-sm font-semibold">{photo.label}</p>
            {photo.markedAt && (
              <p className="text-slate-500 text-xs mt-1">
                {new Date(photo.markedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-slate-500 text-sm hover:text-slate-900 transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

// A player's board: their current board (with reset), or a recorded snapshot
function BoardModal({ user, title, board, cells, highlightLines, onClose, onReset }) {
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [resetting, setResetting] = useState(false);

  const cellMap = cells || {};
  const markedSet = markedSetFrom(cellMap);
  const winLines = highlightLines || checkBingo(markedSet);
  const winSet = new Set(winLines.flat());

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="glass-card rounded-2xl w-full max-w-md my-4 fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-slate-800 font-bold text-lg">{user.name}</h2>
                {user.isGuest && <span className="badge badge-gray mt-1">Tamu</span>}
                {user.email && (
                  <p className="text-slate-400 text-[11px] mt-1 break-all">
                    {user.email}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-900 text-xl leading-none mt-0.5"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              {title && <span className="badge badge-gold">{title}</span>}
              <span className="text-xs text-slate-500">{markedSet.size}/25 sel</span>
              {checkBingo(markedSet).length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-amber-600">
                    🏆 {checkBingo(markedSet).length} line
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
            {board.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-6">
                Pemain belum membuka papannya.
              </p>
            ) : (
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
                        borderColor: isWin ? "#ff9f43" : isFree ? "#ffc93c" : isMarked ? "#8ee3d8" : "#f1e6da",
                        background: isFree ? "#fff4cc" : "#ffffff",
                        boxShadow: isWin ? "0 0 0 2px #ffd9a8" : "none",
                      }}
                      onClick={
                        hasPhoto
                          ? () =>
                              setPreviewPhoto({
                                photoUrl: fullPhoto(cs.photoUrl),
                                label: cell.label,
                                markedAt: cs.markedAt,
                              })
                          : undefined
                      }
                    >
                      {hasPhoto ? (
                        <>
                          <img
                            src={thumb(cs.photoUrl, 160)}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          {isWin && (
                            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-orange-400 rounded-full flex items-center justify-center">
                              <span className="text-white" style={{ fontSize: "6px" }}>
                                ★
                              </span>
                            </div>
                          )}
                        </>
                      ) : isFree ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xs">⭐</span>
                          <span className="text-[6px] text-amber-600 font-bold">
                            {cell.label || "GARUT"}
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-0.5">
                          <p className="text-[6px] text-slate-400 text-center leading-tight">
                            {cell.label}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {Object.values(cellMap).some((v) => v?.photoUrl) && (
              <p className="text-center text-slate-400 text-[10px] mt-2">
                Klik sel dengan foto untuk melihat gambar
              </p>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-2">
            {onReset && (
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      `Reset ${user.name}? Papan, sel terisi, riwayat papan, dan rekor akan dihapus. Foto tetap tersimpan di Cloudinary.`,
                    )
                  )
                    return;
                  setResetting(true);
                  try {
                    await onReset();
                  } finally {
                    setResetting(false);
                  }
                }}
                disabled={resetting}
                className="btn-danger rounded-xl px-4 py-2.5 text-white text-sm"
              >
                {resetting ? "Mereset..." : "Reset"}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 glass-card rounded-xl py-2.5 text-slate-600 text-sm hover:text-slate-900 transition-colors"
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

function RankBadge({ i }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{
        background:
          i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#ffb38a",
        color: "white",
      }}
    >
      {i + 1}
    </div>
  );
}

// One leaderboard: rows = [{ user, time, detail, onView, viewLabel }]
function Leaderboard({ title, icon, rows, eventStart }) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <h2 className="text-amber-600 font-bold text-sm mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-slate-500 text-xs">Belum ada peserta.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div
              key={r.user.id}
              className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
            >
              <RankBadge i={i} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 text-sm font-medium truncate">{r.user.name}</p>
              </div>
              <div className="text-right">
                {r.time ? (
                  <>
                    <p className="text-amber-600 text-xs font-mono">
                      {new Date(r.time).toLocaleTimeString("id-ID")}
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      {elapsed(r.time, eventStart) || new Date(r.time).toLocaleDateString("id-ID")}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 text-[11px]">{r.detail}</p>
                )}
              </div>
              <button
                onClick={r.onView}
                className="text-[11px] text-slate-500 hover:text-slate-900 px-2 py-1 glass-card rounded-lg flex-shrink-0"
              >
                {r.viewLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("players"); // players | competition
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // BoardModal props
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting, setExporting] = useState(null); // progress text

  const loadData = async () => {
    try {
      setData(await api("/api/admin/overview"));
      setLastRefresh(new Date());
    } catch {
      // keep showing the last data; the next refresh will retry
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = async () => {
    setExporting("Menyiapkan data...");
    try {
      const [exportData, { buildPhotoExport }] = await Promise.all([
        api("/api/admin/export"),
        import("../lib/exportPhotos"), // JSZip is only needed here
      ]);
      const { blob, failed } = await buildPhotoExport(exportData, (p) =>
        setExporting(
          p.stage === "zip"
            ? `Membuat ZIP... ${p.percent}%`
            : `Mengunduh foto & papan ${p.done}/${p.total}`,
        ),
      );
      const link = document.createElement("a");
      link.download = `bingo-foto-${new Date().toISOString().slice(0, 10)}.zip`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      if (failed) alert(`${failed} foto gagal diunduh. Lihat GAGAL-DIUNDUH.txt di ZIP.`);
    } catch {
      alert("Ekspor gagal. Coba lagi.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="relative z-10 text-center">
          <div className="spinner mb-4" />
          <p className="text-slate-500 text-sm">Memuat data admin...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <button onClick={loadData} className="relative z-10 glass-card rounded-xl px-4 py-2 text-slate-600 text-sm">
          Gagal memuat data. Coba lagi
        </button>
      </div>
    );
  }

  const { users, states, boards, records, masterCells, event } = data;
  const allUsers = Object.values(users);

  // Per-player derived stats for the current board
  const info = {};
  allUsers.forEach((u) => {
    const cells = states[u.id]?.cells || {};
    const marked = markedSetFrom(cells);
    info[u.id] = {
      cells,
      filled: marked.size,
      lines: checkBingo(marked).length,
      toLine: cellsToLine(cells),
      updatedAt: states[u.id]?.updatedAt || u.registeredAt,
      rec: records[u.id] || {},
    };
  });

  const byTimeThen = (key, tiebreak) => (a, b) => {
    const ta = info[a.id].rec[key];
    const tb = info[b.id].rec[key];
    if (ta && tb) return new Date(ta) - new Date(tb);
    if (ta) return -1;
    if (tb) return 1;
    return tiebreak(a, b) || new Date(info[a.id].updatedAt) - new Date(info[b.id].updatedAt);
  };
  const bingoRanking = [...allUsers].sort(
    byTimeThen(
      "firstBingoAt",
      (a, b) => info[a.id].toLine - info[b.id].toLine || info[b.id].filled - info[a.id].filled,
    ),
  );
  const fullRanking = [...allUsers].sort(
    byTimeThen("fullAt", (a, b) => info[b.id].filled - info[a.id].filled),
  );

  const bingoCount = allUsers.filter((u) => info[u.id].rec.firstBingoAt).length;
  const fullCount = allUsers.filter((u) => info[u.id].rec.fullAt).length;
  const status = eventStatus(event.start, event.end);

  const currentBoardModal = (u) => ({
    user: u,
    title: `Papan saat ini #${boards[u.id]?.round || 1}`,
    board: buildBoard(boards[u.id]?.positions, masterCells),
    cells: info[u.id].cells,
    onReset: () => resetUser(u.id),
  });
  const snapshotModal = (u, snapshot, title) => ({
    user: u,
    title,
    board: snapshot.board,
    cells: snapshot.cells,
    highlightLines: snapshot.lines?.length ? snapshot.lines : undefined,
  });

  const resetUser = async (userId) => {
    await api(`/api/admin/users/${userId}`, { method: "DELETE" });
    setModal(null);
    await loadData();
  };

  const filteredUsers = allUsers
    .filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      if (filter === "bingo") return matchSearch && info[u.id].rec.firstBingoAt;
      if (filter === "full") return matchSearch && info[u.id].rec.fullAt;
      return matchSearch;
    })
    .sort((a, b) => info[b.id].filled - info[a.id].filled);

  return (
    <>
      <Head>
        <title>Admin — Piknik Bingo</title>
      </Head>
      <div className="bingo-bg min-h-screen">

        {/* Navbar */}
        <nav className="navbar relative z-10 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-slate-400 hover:text-slate-900 transition-colors text-sm"
            >
              ←
            </Link>
            <span className="text-slate-800 font-bold text-sm">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!!exporting}
              className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 glass-card rounded-lg transition-colors disabled:opacity-60"
            >
              ⬇ Ekspor Foto
            </button>
            <Link
              href="/master"
              className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 glass-card rounded-lg transition-colors"
            >
              Master
            </Link>
            <button
              onClick={loadData}
              className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 glass-card rounded-lg transition-colors"
            >
              ↻
            </button>
          </div>
        </nav>

        <div className="relative z-10 px-4 py-6 max-w-5xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Peserta", value: allUsers.length, icon: "👥" },
              { label: "Dapat Bingo", value: bingoCount, icon: "🏆" },
              { label: "Papan Penuh", value: fullCount, icon: "👑" },
              {
                label: event.start || event.end ? "Status Event" : "Waktu event belum diatur",
                value: { before: "Belum mulai", open: "Berlangsung", after: "Selesai" }[status],
                icon: "⏱",
              },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-slate-800 font-black text-xl">{s.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex gap-1 glass-card rounded-xl p-1 mb-4 w-fit">
            {[
              { key: "players", label: "Peserta" },
              { key: "competition", label: "🏆 Kompetisi" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === t.key ? "bg-orange-400 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {view === "competition" ? (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Leaderboard
                title="Bingo Pertama Tercepat"
                icon="🏆"
                eventStart={event.start}
                rows={bingoRanking.map((u) => {
                  const { rec, toLine } = info[u.id];
                  return {
                    user: u,
                    time: rec.firstBingoAt,
                    detail: `kurang ${toLine} sel`,
                    viewLabel: rec.firstBingoSnapshot ? "Snapshot" : "Papan",
                    onView: () =>
                      setModal(
                        rec.firstBingoSnapshot
                          ? snapshotModal(u, rec.firstBingoSnapshot, "Snapshot Bingo pertama")
                          : currentBoardModal(u),
                      ),
                  };
                })}
              />
              <Leaderboard
                title="Papan Penuh Tercepat"
                icon="👑"
                eventStart={event.start}
                rows={fullRanking.map((u) => {
                  const { rec, filled } = info[u.id];
                  return {
                    user: u,
                    time: rec.fullAt,
                    detail: `${filled}/25 sel`,
                    viewLabel: rec.fullSnapshot ? "Snapshot" : "Papan",
                    onView: () =>
                      setModal(
                        rec.fullSnapshot
                          ? snapshotModal(u, rec.fullSnapshot, "Snapshot papan penuh")
                          : currentBoardModal(u),
                      ),
                  };
                })}
              />
            </div>
          ) : (
            <>
              {/* Search + filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari alias atau email..."
                  className="glass-input rounded-xl px-4 py-2.5 text-slate-800 text-sm flex-1"
                />
                <div className="flex gap-1 glass-card rounded-xl p-1">
                  {[
                    { key: "all", label: `Semua (${allUsers.length})` },
                    { key: "bingo", label: `Bingo (${bingoCount})` },
                    { key: "full", label: `Penuh (${fullCount})` },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setFilter(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        filter === t.key
                          ? "bg-orange-400 text-white"
                          : "text-slate-500 hover:text-slate-900"
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
                  <div className="p-8 text-center text-slate-500 text-sm">Tidak ada data.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Alias</th>
                          <th>Progress</th>
                          <th>Papan</th>
                          <th>Status</th>
                          <th>Bingo pertama</th>
                          <th>Papan penuh</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, i) => {
                          const { cells, filled, lines, rec } = info[u.id];
                          return (
                            <tr key={u.id}>
                              <td className="text-slate-400 font-mono text-xs">{i + 1}</td>
                              <td>
                                <div className="font-medium text-slate-800 text-sm">
                                  {u.name}
                                  {u.isGuest && (
                                    <span className="badge badge-gray ml-1">Tamu</span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[10px]">
                                  Papan #{boards[u.id]?.round || 1}
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="progress-bar w-16">
                                    <div
                                      className="progress-fill"
                                      style={{ width: `${(filled / 25) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500 font-mono">
                                    {filled}/25
                                  </span>
                                </div>
                              </td>
                              <td>
                                <MiniGrid cellStates={cells} />
                              </td>
                              <td>
                                {filled === 25 ? (
                                  <span className="badge badge-green">👑 Penuh</span>
                                ) : lines > 0 ? (
                                  <span className="badge badge-gold">🏆 {lines} line</span>
                                ) : (
                                  <span className="badge badge-gray">Bermain</span>
                                )}
                              </td>
                              <td className="text-[11px] text-amber-600 font-mono whitespace-nowrap">
                                {rec.firstBingoAt ? fmtTime(rec.firstBingoAt) : "—"}
                              </td>
                              <td className="text-[11px] text-teal-600 font-mono whitespace-nowrap">
                                {rec.fullAt ? fmtTime(rec.fullAt) : "—"}
                              </td>
                              <td>
                                <button
                                  onClick={() => setModal(currentBoardModal(u))}
                                  className="text-xs text-slate-400 hover:text-slate-900 transition-colors px-2 py-1 glass-card rounded-lg"
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
            </>
          )}

          {lastRefresh && (
            <p className="text-center text-slate-400 text-xs">
              Terakhir diperbarui: {lastRefresh.toLocaleTimeString("id-ID")} ·
              Auto-refresh setiap 30 detik
            </p>
          )}
        </div>

        {modal && <BoardModal {...modal} onClose={() => setModal(null)} />}

        {exporting && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[70] p-4">
            <div className="glass-card rounded-2xl p-8 text-center fade-in max-w-xs">
              <div className="spinner mb-4" />
              <p className="text-slate-800 font-semibold">Mengekspor foto</p>
              <p className="text-slate-500 text-xs mt-1">{exporting}</p>
              <p className="text-slate-400 text-[10px] mt-3">
                Jangan tutup halaman ini sampai ZIP terunduh.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
