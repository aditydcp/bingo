import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Head from "next/head";

const API = "";
const FREE_POS = 12; // center of the 5×5 grid — always FREE
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
  const diag1 = [0, 6, 12, 18, 24];
  const diag2 = [4, 8, 12, 16, 20];
  if (diag1.every(has)) lines.push(diag1);
  if (diag2.every(has)) lines.push(diag2);

  return lines;
}

export default function BingoPage() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [board, setBoard] = useState(null); // user's personal 25-cell ordered array
  const [cells, setCells] = useState({}); // keyed by board position (0-24)
  const [winLines, setWinLines] = useState([]);
  const [finished, setFinished] = useState(false);
  const [finishTime, setFinishTime] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewCell, setPreviewCell] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const markedSet = new Set(
    Object.entries(cells)
      .filter(([, v]) => v?.marked)
      .map(([k]) => Number(k)),
  );
  const winSet = new Set(winLines.flat());
  const hasBingo = winLines.length > 0;
  const markedCount = markedSet.size;

  const recomputeBingo = useCallback((cellMap) => {
    const ms = new Set(
      Object.entries(cellMap)
        .filter(([, v]) => v?.marked)
        .map(([k]) => Number(k)),
    );
    setWinLines(checkBingo(ms));
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("bingo_user");
    if (!raw) {
      router.replace("/");
      return;
    }
    const u = JSON.parse(raw);
    setUser(u);

    // Bingo-state returns cells, board, and completion status from the DB
    axios
      .get(`${API}/api/bingo-state/${u.userId}`)
      .then(({ data }) => {
        setBoard(data.board);
        const loaded = data.cells || {};
        loaded[FREE_POS] = { ...loaded[FREE_POS], marked: true, isFree: true };
        setCells(loaded);
        recomputeBingo(loaded);

        // DB is authoritative for finish status
        if (data.completion) {
          setFinished(true);
          setFinishTime(data.completion.completedAt);
          localStorage.setItem(
            `bingo_finish_${u.userId}`,
            JSON.stringify({ time: data.completion.completedAt }),
          );
        } else {
          // Fallback to localStorage (fast path, offline)
          const fd = localStorage.getItem(`bingo_finish_${u.userId}`);
          if (fd) {
            try {
              const { time } = JSON.parse(fd);
              setFinished(true);
              setFinishTime(time);
            } catch {}
          }
        }
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          localStorage.removeItem("bingo_user");
        }
        router.replace("/");
      });
  }, []);

  const handleCellClick = (pos) => {
    if (pos === FREE_POS) return;
    const state = cells[pos];
    if (state?.marked && state?.photoUrl) {
      setPreviewCell(pos);
      return;
    }
    if (state?.marked) return;
    setSelectedCell(pos);
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || selectedCell === null) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const { data } = await axios.post(
        `${API}/api/upload/${user.userId}/${selectedCell}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const updated = {
        ...cells,
        [selectedCell]: {
          marked: true,
          photoUrl: data.photoUrl,
          markedAt: new Date().toISOString(),
        },
      };
      setCells(updated);
      recomputeBingo(updated);
    } catch {
      alert("Upload gagal. Coba lagi.");
    } finally {
      setUploading(false);
      setSelectedCell(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFinishConfirm = async () => {
    try {
      const { data } = await axios.post(`${API}/api/finish`, {
        userId: user.userId,
      });
      setFinished(true);
      setFinishTime(data.completedAt);
      localStorage.setItem(
        `bingo_finish_${user.userId}`,
        JSON.stringify({ time: data.completedAt }),
      );
      setShowFinishModal(false);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    }
  };

  if (!user || !board) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="grid-overlay" />
        <div className="relative z-10 text-center">
          <div className="spinner mb-4" />
          <p className="text-blue-300 text-sm">Memuat bingo board...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Bingo — {user.name}</title>
      </Head>
      <div className="bingo-bg min-h-screen">
        <div className="grid-overlay" />

        {/* Navbar */}
        <nav className="navbar relative z-10 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-white font-bold text-sm">
              FIRST SUMMIT Bingo
            </span>
            <span className="ml-2 text-blue-400 text-xs">
              '{new Date().getFullYear().toString().slice(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-xs font-medium">{user.name}</p>
              <p className="text-blue-400 text-[10px]">{user.entitas}</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("bingo_user");
                router.push("/");
              }}
              className="text-blue-400 hover:text-white text-xs transition-colors hidden"
            >
              Ganti
            </button>
          </div>
        </nav>

        <div className="relative z-10 px-3 pb-8 max-w-lg mx-auto">
          {/* Bingo banner */}
          {hasBingo && (
            <div className="bingo-banner rounded-xl p-3 my-3 text-center fade-in">
              <p className="text-xl font-black text-yellow-300 tracking-widest">
                🎉 B I N G O !
              </p>
              {finished ? (
                <p className="text-green-300 text-xs mt-1">
                  Selesai · {new Date(finishTime).toLocaleString("id-ID")}
                </p>
              ) : (
                <p className="text-blue-200 text-xs mt-1">
                  Kamu berhasil! Klik tombol Finish untuk menyelesaikan.
                </p>
              )}
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-3 my-3">
            <div className="progress-bar flex-1">
              <div
                className="progress-fill"
                style={{ width: `${(markedCount / 25) * 100}%` }}
              />
            </div>
            <span className="text-blue-300 text-xs font-mono whitespace-nowrap">
              {markedCount}/25
            </span>
          </div>

          {/* Bingo grid — rendered from user's personal board */}
          <div className="bingo-grid">
            {LETTERS.map((l) => (
              <div key={l} className="bingo-header-cell">
                {l}
              </div>
            ))}

            {board.map((cell) => {
              const pos = cell.id; // board position 0-24
              const state = cells[pos];
              const isMarked = !!state?.marked;
              const isFree = pos === FREE_POS;
              const isWin = winSet.has(pos);
              const hasPhoto = !!state?.photoUrl;

              return (
                <div
                  key={pos}
                  className={`bingo-cell ${isMarked ? "marked" : "unmarked"} ${isWin ? "winning" : ""} ${isFree ? "free-cell" : ""}`}
                  onClick={() => handleCellClick(pos)}
                >
                  {hasPhoto ? (
                    <>
                      <img
                        src={`${API}${state.photoUrl}`}
                        alt="cell"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="marked-overlay">
                        <span>✓</span>
                      </div>
                    </>
                  ) : isFree ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-lg">⭐</span>
                      <span className="text-[9px] font-bold text-yellow-300 tracking-widest">
                        FREE
                      </span>
                    </div>
                  ) : isMarked ? (
                    <div className="flex flex-col items-center gap-0.5 p-1">
                      <span className="text-green-400 text-lg">✓</span>
                      <p className="text-[8px] text-green-300 text-center leading-tight line-clamp-2">
                        {cell.label}
                      </p>
                    </div>
                  ) : (
                    <div className="p-1 flex flex-col items-center justify-center h-full">
                      <p className="text-[9px] leading-tight text-center text-blue-100 line-clamp-3">
                        {cell.label}
                      </p>
                      <div className="mt-1 w-4 h-4 rounded-full border border-blue-400/40 flex items-center justify-center">
                        <span className="text-[8px] text-blue-400">+</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finish button */}
          {hasBingo && !finished && (
            <button
              onClick={() => setShowFinishModal(true)}
              className="btn-finish w-full rounded-xl py-4 text-white font-black text-base mt-4 tracking-wide"
            >
              🏆 FINISH BINGO!
            </button>
          )}

          {finished && (
            <div className="glass-card rounded-xl p-4 mt-4 text-center">
              <p className="text-green-400 font-bold text-sm">
                ✅ Bingo Selesai!
              </p>
              <p className="text-blue-200 text-xs mt-1">
                {new Date(finishTime).toLocaleString("id-ID", {
                  dateStyle: "full",
                  timeStyle: "medium",
                })}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-5 flex gap-4 justify-center">
            <span className="flex items-center gap-1.5 text-[10px] text-blue-400">
              <span className="w-3 h-3 rounded-sm bg-blue-600/40 border border-blue-500/30" />
              Belum
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-blue-300">
              <span className="w-3 h-3 rounded-sm bg-blue-500/50 border border-cyan-400/30" />
              Selesai
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-yellow-300">
              <span
                className="w-3 h-3 rounded-sm border border-yellow-400/60"
                style={{ background: "rgba(245,158,11,0.25)" }}
              />
              Bingo!
            </span>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />

        {/* Upload overlay */}
        {uploading && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="glass-card rounded-2xl p-8 text-center fade-in">
              <div className="spinner mb-4" />
              <p className="text-white font-semibold">Mengunggah foto...</p>
              <p className="text-blue-300 text-xs mt-1">Mohon tunggu</p>
            </div>
          </div>
        )}

        {/* Finish confirmation modal */}
        {showFinishModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center fade-in">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-white font-black text-xl mb-2">
                Selesaikan Bingo?
              </h2>
              <p className="text-blue-200 text-sm mb-6">
                Waktu selesai kamu akan dicatat dan disimpan. Admin akan melihat
                hasil bingo kamu.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFinishModal(false)}
                  className="flex-1 glass-card rounded-xl py-3 text-blue-200 text-sm hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleFinishConfirm}
                  className="flex-1 btn-finish rounded-xl py-3 text-white font-bold text-sm"
                >
                  Ya, Selesai!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo preview modal */}
        {previewCell !== null && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewCell(null)}
          >
            <div
              className="max-w-sm w-full fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-card rounded-2xl overflow-hidden">
                <img
                  src={`${API}${cells[previewCell]?.photoUrl}`}
                  alt="Cell photo"
                  className="w-full"
                />
                <div className="p-4">
                  <p className="text-white text-sm font-medium">
                    {board[previewCell]?.label}
                  </p>
                  {cells[previewCell]?.markedAt && (
                    <p className="text-blue-300 text-xs mt-1">
                      {new Date(cells[previewCell].markedAt).toLocaleString(
                        "id-ID",
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    const pos = previewCell;
                    setPreviewCell(null);
                    setSelectedCell(pos);
                    setTimeout(() => fileRef.current?.click(), 50);
                  }}
                  className="flex-1 glass-card rounded-xl py-2.5 text-blue-300 text-sm hover:text-white transition-colors text-center"
                >
                  Ganti Foto
                </button>
                <button
                  onClick={() => setPreviewCell(null)}
                  className="flex-1 glass-card rounded-xl py-2.5 text-blue-200 text-sm hover:text-white transition-colors text-center"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
