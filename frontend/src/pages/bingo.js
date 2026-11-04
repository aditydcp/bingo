import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  FREE_POS,
  LETTERS,
  checkBingo,
  markedSetFrom,
  computeRecords,
  eventStatus,
  thumb,
  fullPhoto,
} from "../lib/bingo";
import { api, getSession, linkGoogle, supabase } from "../lib/supabase";
import { compressImage } from "../lib/compressImage";
import { renderBoardImage, formatTime } from "../lib/boardImage";
import GoogleButton from "../components/GoogleButton";
import Celebration from "../components/Celebration";

const ERROR_TEXT = {
  event_not_started: "Event belum dimulai. Foto bisa diunggah saat event berlangsung.",
  event_closed: "Event sudah selesai. Foto tidak bisa ditambah lagi.",
};

const withFree = (cells) => ({
  ...cells,
  [FREE_POS]: { ...cells?.[FREE_POS], marked: true, isFree: true },
});

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return d ? `${d} hari ${hms}` : hms;
}

export default function BingoPage() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [user, setUser] = useState(null); // { name }
  const [isGuest, setIsGuest] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [board, setBoard] = useState(null); // user's personal 25-cell ordered array
  const [round, setRound] = useState(1);
  const [cells, setCells] = useState({}); // keyed by board position (0-24)
  const [records, setRecords] = useState({});
  const [event, setEvent] = useState({ start: null, end: null });
  const [clockOffset, setClockOffset] = useState(0); // server time − device time
  const [now, setNow] = useState(Date.now());
  const [selectedCell, setSelectedCell] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [previewCell, setPreviewCell] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [celebration, setCelebration] = useState(null); // { kind, lines }
  const [notice, setNotice] = useState("");

  const markedSet = markedSetFrom(cells);
  const winLines = checkBingo(markedSet);
  const winSet = new Set(winLines.flat());
  const hasBingo = winLines.length > 0;
  const markedCount = markedSet.size;
  const status = eventStatus(event.start, event.end, now + clockOffset);
  const canUpload = status === "open";

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Error from a failed "link Google" redirect comes back in the URL hash
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error")) {
      setLinkError(
        hash.get("error_code") === "identity_already_exists"
          ? "Akun Google ini sudah dipakai pemain lain. Gunakan akun Google lain."
          : "Gagal menghubungkan Google. Coba lagi.",
      );
      history.replaceState(null, "", window.location.pathname);
    }

    (async () => {
      if (!(await getSession())) {
        router.replace("/");
        return;
      }
      try {
        const data = await api("/api/state");
        setUser(data.profile);
        setIsGuest(data.isGuest);
        setBoard(data.board);
        setRound(data.round);
        setCells(withFree(data.cells));
        setRecords(data.records);
        setEvent({ start: data.eventStart, end: data.eventEnd });
        setClockOffset(new Date(data.serverNow).getTime() - Date.now());
      } catch {
        router.replace("/");
      }
    })();
  }, []);

  const handleSignOut = async () => {
    if (
      isGuest &&
      !confirm(
        "Kamu bermain sebagai tamu. Jika keluar, progres tidak bisa dipulihkan. Tetap keluar?",
      )
    )
      return;
    await supabase().auth.signOut();
    router.replace("/");
  };

  const handleLinkGoogle = async () => {
    setLinkError("");
    const { error } = await linkGoogle("/bingo");
    if (error) setLinkError("Gagal menghubungkan Google. Coba lagi.");
  };

  const handleReroll = async () => {
    if (
      !confirm(
        "Acak ulang papan?\n\nPapan dan semua sel yang sudah terisi akan direset dengan sel acak baru. Rekor Bingo yang sudah tercatat tetap disimpan.",
      )
    )
      return;
    setRerolling(true);
    try {
      const data = await api("/api/reroll", { method: "POST" });
      setBoard(data.board);
      setRound(data.round);
      setCells(withFree(data.cells));
    } catch {
      alert("Gagal mengacak ulang papan. Coba lagi.");
    } finally {
      setRerolling(false);
    }
  };

  const downloadBingoCard = async () => {
    setDownloading(true);
    try {
      const { firstBingoAt, fullAt } = computeRecords(cells);
      const blob = await renderBoardImage({
        name: user.name,
        board,
        cells,
        highlightLines: winLines,
        title: fullAt ? "PAPAN PENUH!" : "BINGO!",
        subtitle: formatTime(fullAt || firstBingoAt),
      });
      const link = document.createElement("a");
      link.download = `bingo-${user.name.replace(/\s+/g, "-")}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } finally {
      setDownloading(false);
    }
  };

  const openCamera = (pos) => {
    if (!canUpload) {
      setNotice(ERROR_TEXT[status === "before" ? "event_not_started" : "event_closed"]);
      return;
    }
    setSelectedCell(pos);
    fileRef.current?.click();
  };

  const handleCellClick = (pos) => {
    if (pos === FREE_POS) return;
    if (cells[pos]?.photoUrl) {
      setPreviewCell(pos);
      return;
    }
    openCamera(pos);
  };

  const celebrate = (before, after) => {
    const linesBefore = checkBingo(markedSetFrom(before)).length;
    const linesAfter = checkBingo(markedSetFrom(after)).length;
    const full = (c) => markedSetFrom(c).size === 25;
    if (full(after) && !full(before)) setCelebration({ kind: "full" });
    else if (linesBefore === 0 && linesAfter > 0) setCelebration({ kind: "bingo" });
    else if (linesAfter > linesBefore) setCelebration({ kind: "line", lines: linesAfter });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || selectedCell === null) return;
    setUploading(true);
    try {
      // compress on the phone → signed direct upload to Cloudinary → record on our API
      const [photo, sig] = await Promise.all([
        compressImage(file),
        api("/api/upload-signature", { method: "POST", body: { position: selectedCell } }),
      ]);
      const fd = new FormData();
      fd.append("file", photo);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", sig.timestamp);
      fd.append("public_id", sig.publicId);
      fd.append("signature", sig.signature);
      const uploadRes = await fetch(sig.uploadUrl, { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("cloudinary upload failed");
      const uploaded = await uploadRes.json();
      const data = await api("/api/cells", {
        method: "POST",
        body: {
          position: selectedCell,
          photoUrl: uploaded.secure_url,
          publicId: uploaded.public_id,
        },
      });
      const updated = { ...cells, [selectedCell]: data.cell };
      setCells(updated);
      setRecords(data.records);
      celebrate(cells, updated);
    } catch (err) {
      alert(ERROR_TEXT[err.message] || "Upload gagal. Coba lagi.");
    } finally {
      setUploading(false);
      setSelectedCell(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!user || !board) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="relative z-10 text-center">
          <div className="spinner mb-4" />
          <p className="text-slate-500 text-sm">Memuat bingo board...</p>
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

        {/* Navbar */}
        <nav className="navbar relative z-10 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="font-black text-base text-slate-800">
              FIRST <span className="text-orange-500">Bingo</span> 🎉
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-gold max-w-[9rem] truncate">{user.name}</span>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-slate-900 text-xs transition-colors px-2 py-1"
            >
              Keluar
            </button>
          </div>
        </nav>

        <div className="relative z-10 px-3 pb-8 max-w-xl mx-auto">
          {/* Event window */}
          {status === "before" && (
            <div className="glass-card rounded-xl p-3 mt-3 text-center border border-orange-200">
              <p className="text-slate-600 text-xs">Event dimulai dalam</p>
              <p className="text-orange-500 font-mono font-bold text-xl mt-0.5">
                {countdown(new Date(event.start).getTime() - (now + clockOffset))}
              </p>
              <p className="text-slate-400 text-[10px] mt-1">
                {formatTime(event.start)} · Kamu sudah bisa melihat papan dan mengacak ulang
              </p>
            </div>
          )}
          {status === "after" && (
            <div className="glass-card rounded-xl p-3 mt-3 text-center border border-rose-200">
              <p className="text-rose-600 font-semibold text-sm">Event telah selesai</p>
              <p className="text-slate-500 text-xs mt-0.5">Foto tidak bisa ditambah atau diganti lagi.</p>
            </div>
          )}
          {status === "open" && event.end && (
            <p className="text-center text-slate-500 text-[11px] mt-3">
              Event berakhir dalam{" "}
              <span className="font-mono text-orange-500">
                {countdown(new Date(event.end).getTime() - (now + clockOffset))}
              </span>
            </p>
          )}

          {/* Guest → Google upgrade */}
          {isGuest && (
            <div className="glass-card rounded-xl p-3 mt-3 border border-amber-200">
              <p className="text-amber-700 text-xs mb-2">
                Kamu bermain sebagai tamu — progres hanya tersimpan di perangkat
                ini. Hubungkan Google agar progres aman dan bisa dibuka di
                perangkat lain.
              </p>
              <GoogleButton onClick={handleLinkGoogle} label="Simpan progres dengan Google" />
            </div>
          )}
          {linkError && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
              {linkError}
            </div>
          )}
          {notice && (
            <div
              className="mt-3 px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-slate-600 text-xs"
              onClick={() => setNotice("")}
            >
              {notice}
            </div>
          )}

          {/* Bingo banner */}
          {hasBingo && (
            <div className="bingo-banner rounded-xl p-3 my-3 text-center fade-in">
              <p className="text-xl font-black text-amber-600 tracking-widest">
                🎉 B I N G O !
              </p>
              <p className="text-slate-600 text-xs mt-1">
                {winLines.length} line selesai
                {markedCount < 25 && " · Lanjutkan sampai papan penuh!"}
              </p>
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
            <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
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
                        src={thumb(state.photoUrl)}
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
                      <span className="text-[9px] font-bold text-amber-600 tracking-widest">
                        {cell.label || "GARUT"}
                      </span>
                    </div>
                  ) : (
                    <div className="p-1 flex flex-col items-center justify-center h-full">
                      <p className="text-[9px] leading-tight text-center text-slate-700">
                        {cell.label}
                      </p>
                      {canUpload && (
                        <div className="mt-1 w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center">
                          <span className="text-[8px] text-slate-400">📷</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recorded times */}
          {(records.firstBingoAt || records.fullAt) && (
            <div className="glass-card rounded-xl p-4 mt-4 space-y-2">
              <p className="text-slate-800 font-semibold text-sm">🏅 Rekor kamu</p>
              {records.firstBingoAt && (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-slate-500">Bingo pertama</span>
                  <span className="text-amber-600 text-right">
                    {new Date(records.firstBingoAt).toLocaleString("id-ID")}
                    {records.firstBingoRound !== round && (
                      <span className="text-slate-400"> (papan sebelumnya)</span>
                    )}
                  </span>
                </div>
              )}
              {records.fullAt && (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-slate-500">Papan penuh</span>
                  <span className="text-teal-600 text-right">
                    {new Date(records.fullAt).toLocaleString("id-ID")}
                    {records.fullRound !== round && (
                      <span className="text-slate-400"> (papan sebelumnya)</span>
                    )}
                  </span>
                </div>
              )}
              <p className="text-slate-400 text-[10px]">
                Mengganti foto di line yang menang akan memperbarui waktu rekor.
              </p>
            </div>
          )}

          {hasBingo && (
            <button
              onClick={downloadBingoCard}
              className="mt-4 w-full glass-card rounded-xl py-3 text-orange-500 text-sm font-semibold hover:text-slate-900 transition-colors border border-orange-200 hover:border-orange-300"
            >
              ⬇ Unduh Kartu Bingo
            </button>
          )}

          <button
            onClick={handleReroll}
            disabled={rerolling || uploading}
            className="mt-3 w-full glass-card rounded-xl py-3 text-slate-600 text-sm hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            {rerolling ? "Mengacak..." : "🔀 Acak Ulang Papan"}
          </button>

          {/* Legend */}
          <div className="mt-5 flex gap-4 justify-center">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
              Belum
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300" />
              Selesai
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-amber-600">
              <span
                className="w-3 h-3 rounded-sm border border-amber-400 bg-amber-100"
              />
              Bingo!
            </span>
          </div>
        </div>

        {/* Hidden file input — opens the rear camera on phones */}
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />

        {/* Download overlay */}
        {downloading && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
            <div className="glass-card rounded-2xl p-8 text-center fade-in">
              <div className="spinner mb-4" />
              <p className="text-slate-800 font-semibold">Membuat kartu bingo...</p>
              <p className="text-slate-500 text-xs mt-1">Mohon tunggu</p>
            </div>
          </div>
        )}

        {/* Upload overlay */}
        {uploading && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
            <div className="glass-card rounded-2xl p-8 text-center fade-in">
              <div className="spinner mb-4" />
              <p className="text-slate-800 font-semibold">Mengunggah foto...</p>
              <p className="text-slate-500 text-xs mt-1">Mohon tunggu</p>
            </div>
          </div>
        )}

        {celebration && (
          <Celebration
            kind={celebration.kind}
            lines={celebration.lines}
            onClose={() => setCelebration(null)}
          />
        )}

        {/* Photo preview modal */}
        {previewCell !== null && (
          <div
            className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewCell(null)}
          >
            <div
              className="max-w-sm w-full fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-card rounded-2xl overflow-hidden">
                <img
                  src={fullPhoto(cells[previewCell]?.photoUrl)}
                  alt="Cell photo"
                  className="w-full"
                />
                <div className="p-4">
                  <p className="text-slate-800 text-sm font-medium">
                    {board[previewCell]?.label}
                  </p>
                  {cells[previewCell]?.markedAt && (
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(cells[previewCell].markedAt).toLocaleString(
                        "id-ID",
                      )}
                    </p>
                  )}
                  {winSet.has(previewCell) && canUpload && (
                    <p className="text-amber-600 text-[11px] mt-2">
                      Sel ini bagian dari line Bingo. Mengganti fotonya akan
                      memperbarui waktu rekor kamu.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {canUpload && (
                  <button
                    onClick={() => {
                      const pos = previewCell;
                      setPreviewCell(null);
                      setTimeout(() => openCamera(pos), 50);
                    }}
                    className="flex-1 glass-card rounded-xl py-2.5 text-slate-500 text-sm hover:text-slate-900 transition-colors text-center"
                  >
                    Ganti Foto
                  </button>
                )}
                <button
                  onClick={() => setPreviewCell(null)}
                  className="flex-1 glass-card rounded-xl py-2.5 text-slate-600 text-sm hover:text-slate-900 transition-colors text-center"
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
