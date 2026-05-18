import { useState, useEffect } from "react";
import axios from "axios";
import Head from "next/head";
import Link from "next/link";

const API = "";
const FREE_CELL = 12;
const LETTERS = ["F", "I", "R", "S", "T"];

export default function MasterPage() {
  const [cells, setCells] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/master/config`).then(({ data }) => {
      setCells(data.cells || []);
    });
  }, []);

  const updateLabel = (id, value) => {
    setCells((prev) =>
      prev.map((c) => (c.id === id ? { ...c, label: value } : c)),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/master/config`, { cells });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (!confirm("Reset semua label ke default?")) return;
    const defaults = [
      "Foto di area registrasi",
      "Follow Instagram IDSurvey",
      "Scan QR code agenda",
      "Berkenalan dengan peserta baru",
      "Selfie dengan pembicara",
      "Ajukan pertanyaan di sesi",
      "Kunjungi booth Finance",
      "Foto dengan tim IDSurvey",
      "Kunjungi booth IT",
      "Isi survei kepuasan",
      "Kunjungi booth Risk Mgt",
      "Ikut workshop / breakout",
      "FREE",
      "Kunjungi booth Sustainability",
      "Kunjungi booth TJSL",
      "Foto di photobooth resmi",
      "Tukar merchandise",
      "Ikut live demo produk",
      "Ambil goodie bag",
      "Share di LinkedIn / IG",
      "Networking sesi makan siang",
      "Review acara di Google",
      "Foto panorama venue",
      "Kumpulkan 3 kartu nama",
      "Dokumentasi momen terbaik",
    ];
    setCells((prev) =>
      prev.map((c, i) => ({ ...c, label: defaults[i] || c.label })),
    );
    setSaved(false);
  };

  return (
    <>
      <Head>
        <title>Master Panel — IDSurvey Bingo</title>
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
            <span className="text-white font-bold text-sm">Master Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin-one-only"
              className="text-xs text-blue-300 hover:text-white px-3 py-1.5 glass-card rounded-lg transition-colors"
            >
              Admin View
            </Link>
          </div>
        </nav>

        <div className="relative z-10 px-4 py-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white">
              Bingo Master Panel
            </h1>
            <p className="text-blue-300 text-sm mt-1">
              Edit label setiap sel bingo. Klik sel untuk mengedit.
            </p>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total Sel", value: "25", icon: "🎯" },
              { label: "Baris / Kolom", value: "5×5", icon: "📋" },
              { label: "Sel FREE", value: "Tengah", icon: "⭐" },
            ].map((s) => (
              <div
                key={s.label}
                className="glass-card rounded-xl p-3 text-center"
              >
                <div className="text-lg mb-1">{s.icon}</div>
                <div className="text-white font-bold text-sm">{s.value}</div>
                <div className="text-blue-400 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Grid editor */}
          {cells.length > 0 && (
            <div className="glass-card rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-sm">
                  Grid Editor
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={resetToDefault}
                    className="text-xs text-blue-300 hover:text-white px-3 py-1.5 glass-card rounded-lg transition-colors"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-5 gap-2 mb-2">
                {LETTERS.map((l) => (
                  <div
                    key={l}
                    className="bingo-header-cell h-8 rounded-md text-sm"
                  >
                    {l}
                  </div>
                ))}
              </div>

              {/* Cell grid */}
              <div className="grid grid-cols-5 gap-2">
                {cells.map((cell) => {
                  const isFree = cell.id === FREE_CELL;
                  const isSelected = selectedCell === cell.id;
                  return (
                    <div
                      key={cell.id}
                      className={`relative rounded-lg border transition-all cursor-pointer ${
                        isFree
                          ? "border-yellow-500/50 bg-yellow-500/10"
                          : isSelected
                            ? "border-cyan-400/70 bg-blue-500/20"
                            : "border-blue-500/20 bg-blue-900/20 hover:border-blue-400/40"
                      }`}
                      style={{ aspectRatio: "1" }}
                      onClick={() =>
                        !isFree && setSelectedCell(isSelected ? null : cell.id)
                      }
                    >
                      <div className="absolute inset-0 flex items-center justify-center p-1">
                        {isFree ? (
                          <div className="text-center">
                            <div className="text-xl">⭐</div>
                            <div className="text-[9px] text-yellow-300 font-bold">
                              FREE
                            </div>
                          </div>
                        ) : (
                          <p className="text-[8px] text-blue-100 text-center leading-tight line-clamp-3">
                            {cell.label}
                          </p>
                        )}
                      </div>
                      {!isFree && (
                        <div className="absolute top-0.5 right-0.5 text-[8px] text-blue-500">
                          {cell.id + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edit panel */}
          {selectedCell !== null && (
            <div className="glass-card rounded-2xl p-5 mb-6 fade-in border border-cyan-500/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm">
                  Edit Sel #{selectedCell + 1}
                  <span className="ml-2 text-xs text-blue-400">
                    ({LETTERS[Math.floor(selectedCell / 5)]}
                    {(selectedCell % 5) + 1})
                  </span>
                </h2>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-blue-400 hover:text-white text-xs"
                >
                  Tutup ×
                </button>
              </div>
              <textarea
                value={cells[selectedCell]?.label || ""}
                onChange={(e) => updateLabel(selectedCell, e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm resize-none"
                rows={3}
                placeholder="Label untuk sel ini..."
                maxLength={80}
              />
              <p className="text-blue-400/50 text-xs mt-1 text-right">
                {cells[selectedCell]?.label?.length || 0}/80
              </p>
            </div>
          )}

          {/* All cells list */}
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h2 className="text-white font-semibold text-sm mb-4">
              Semua Label Sel
            </h2>
            <div className="space-y-2">
              {cells.map((cell) => {
                const isFree = cell.id === FREE_CELL;
                return (
                  <div key={cell.id} className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        background: isFree
                          ? "rgba(245,158,11,0.2)"
                          : "rgba(0,100,255,0.15)",
                        color: isFree ? "#fbbf24" : "#93c5fd",
                      }}
                    >
                      {cell.id + 1}
                    </div>
                    {isFree ? (
                      <div className="flex-1 py-1.5 px-3 rounded-lg text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">
                        ⭐ FREE (tidak dapat diubah)
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={cell.label}
                        onChange={(e) => updateLabel(cell.id, e.target.value)}
                        onFocus={() => setSelectedCell(cell.id)}
                        className="flex-1 glass-input rounded-lg px-3 py-1.5 text-white text-sm"
                        placeholder={`Label sel ${cell.id + 1}...`}
                        maxLength={80}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <div className="sticky bottom-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 rounded-xl py-4 font-bold text-sm transition-all ${
                saved ? "bg-green-500/80 text-white" : "btn-primary text-white"
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan...
                </span>
              ) : saved ? (
                "✅ Tersimpan!"
              ) : (
                "Simpan Konfigurasi"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
