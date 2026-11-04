import { useEffect } from "react";
import confetti from "canvas-confetti";

// Full-screen ceremony (kind "bingo" | "full") or a small banner for an extra line (kind "line")
export default function Celebration({ kind, lines, onClose }) {
  const big = kind !== "line";

  useEffect(() => {
    if (!big) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.3 }, zIndex: 70 });
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
    const colors = ["#f59e0b", "#00d4ff", "#0066ff", "#fde68a", "#4ade80"];
    const end = Date.now() + (kind === "full" ? 4000 : 2500);
    let frame;
    const burst = () => {
      confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors, zIndex: 70 });
      confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors, zIndex: 70 });
      if (Date.now() < end) frame = requestAnimationFrame(burst);
    };
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, colors, zIndex: 70 });
    burst();
    navigator.vibrate?.([120, 60, 120, 60, 240]);
    return () => cancelAnimationFrame(frame);
  }, [kind]);

  if (!big) {
    return (
      <div className="fixed top-4 inset-x-4 z-[65] flex justify-center pointer-events-none">
        <div className="bingo-banner rounded-xl px-5 py-3 text-center fade-in pointer-events-auto" onClick={onClose}>
          <p className="text-yellow-300 font-black tracking-widest">+1 LINE! 🎯</p>
          <p className="text-blue-200 text-xs mt-0.5">Total {lines} line selesai</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70"
      onClick={onClose}
    >
      <div className="celebration-pop text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-7xl mb-2">{kind === "full" ? "👑" : "🏆"}</div>
        <p className="celebration-title text-5xl font-black tracking-[0.2em] text-yellow-300">
          {kind === "full" ? "FULL!" : "BINGO!"}
        </p>
        <p className="text-white font-semibold mt-3">
          {kind === "full"
            ? "Luar biasa! Semua sel terisi!"
            : "Selamat! Kamu menyelesaikan satu line!"}
        </p>
        <p className="text-blue-200 text-sm mt-1">
          {kind === "full"
            ? "Waktu papan penuh kamu sudah tercatat."
            : "Waktu Bingo pertama kamu sudah tercatat. Lanjutkan sampai papan penuh!"}
        </p>
        <button
          onClick={onClose}
          className="btn-finish rounded-xl px-8 py-3 text-white font-bold text-sm mt-6"
        >
          Lanjut Main
        </button>
      </div>
    </div>
  );
}
