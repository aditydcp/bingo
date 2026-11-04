import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { api } from "../lib/supabase";
import { isFreeCell, eventStatus, requiredCount } from "../lib/bingo";
import AdminGate from "../components/AdminGate";

// Dealing rules a pool cell can have (none = purely random)
const RULE_OPTIONS = [
  { value: "", label: "Acak" },
  { value: "always", label: "📌 Selalu ada" },
  { value: "group", label: "🔷 Grup" },
];

// ISO ↔ value of <input type="datetime-local"> (in the admin's local time zone)
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

export default function MasterPage() {
  return (
    <AdminGate>
      <MasterPanel />
    </AdminGate>
  );
}

// Edits the event window and the labels of the master cell pool;
// each player's board is 24 random pool cells + the free (GARUT) cell
function MasterPanel() {
  const [cells, setCells] = useState([]);
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    api("/api/admin/config").then((data) => {
      setCells(data.masterCells || []);
      setEventStart(toLocalInput(data.eventStart));
      setEventEnd(toLocalInput(data.eventEnd));
    });
  }, []);

  const status = eventStatus(fromLocalInput(eventStart), fromLocalInput(eventEnd));
  const timeError =
    eventStart && eventEnd && new Date(eventStart) >= new Date(eventEnd)
      ? "Waktu selesai harus setelah waktu mulai."
      : "";

  const selected = cells.find((c) => c.id === selectedCell);
  const alwaysCount = cells.filter((c) => !isFreeCell(c) && c.rule === "always").length;
  const groupCount = cells.filter((c) => !isFreeCell(c) && c.rule === "group").length;
  const ruleError =
    requiredCount(cells) > 24
      ? "Terlalu banyak sel wajib: maksimal 24 (termasuk 1 slot untuk grup)."
      : "";

  const updateCell = (id, patch) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSaved(false);
  };
  const updateLabel = (id, value) => updateCell(id, { label: value });
  const updateRule = (id, value) => updateCell(id, { rule: value || undefined });

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", {
        method: "PUT",
        body: {
          cells,
          eventStart: fromLocalInput(eventStart),
          eventEnd: fromLocalInput(eventEnd),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
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
              href="/admin"
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
              Atur waktu event dan label sel. Setiap peserta mendapat 24 sel
              acak dari pool ini + GARUT di tengah. Perubahan label langsung
              berlaku di semua papan.
            </p>
            <p className="text-blue-300/70 text-xs mt-2">
              📌 Selalu ada: sel muncul di setiap papan. 🔷 Grup: setiap papan
              memuat minimal 1 sel dari grup. Aturan hanya berlaku untuk papan
              yang dibuat atau diacak ulang setelah disimpan.
            </p>
          </div>

          {/* Event window */}
          <div className="glass-card rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm">⏱ Waktu Event</h2>
              <span
                className={`badge ${
                  status === "open" ? "badge-green" : status === "before" ? "badge-blue" : "badge-gray"
                }`}
              >
                {{ before: "Belum mulai", open: "Berlangsung", after: "Selesai" }[status]}
              </span>
            </div>
            <p className="text-blue-300/70 text-xs mb-4">
              Peserta hanya bisa mengunggah foto di antara waktu ini. Kosongkan
              untuk tanpa batas. Waktu mengikuti zona waktu perangkat ini.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Mulai", value: eventStart, set: setEventStart },
                { label: "Selesai", value: eventEnd, set: setEventEnd },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="block text-blue-200 text-xs font-medium mb-1.5">
                    {f.label}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={f.value}
                      onChange={(e) => {
                        f.set(e.target.value);
                        setSaved(false);
                      }}
                      className="flex-1 glass-input rounded-lg px-3 py-2 text-white text-sm"
                      style={{ colorScheme: "dark" }}
                    />
                    {f.value && (
                      <button
                        onClick={() => {
                          f.set("");
                          setSaved(false);
                        }}
                        className="text-blue-400 hover:text-white text-xs px-2"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {timeError && <p className="text-red-300 text-xs mt-2">{timeError}</p>}
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Sel di Pool", value: String(cells.length), icon: "🎯" },
              { label: "Selalu Ada", value: String(alwaysCount), icon: "📌" },
              { label: "Sel di Grup", value: String(groupCount), icon: "🔷" },
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
                  Pool Sel
                </h2>
              </div>

              {/* Cell grid */}
              <div className="grid grid-cols-5 gap-2">
                {cells.map((cell) => {
                  const isFree = isFreeCell(cell);
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
                              {cell.label}
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
                      {!isFree && cell.rule && (
                        <div className="absolute top-0.5 left-0.5 text-[8px]">
                          {cell.rule === "always" ? "📌" : "🔷"}
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
                </h2>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-blue-400 hover:text-white text-xs"
                >
                  Tutup ×
                </button>
              </div>
              <textarea
                value={selected?.label || ""}
                onChange={(e) => updateLabel(selectedCell, e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm resize-none"
                rows={3}
                placeholder="Label untuk sel ini..."
                maxLength={80}
              />
              <p className="text-blue-400/50 text-xs mt-1 text-right">
                {selected?.label?.length || 0}/80
              </p>
              <div className="flex gap-2 mt-2">
                {RULE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => updateRule(selectedCell, o.value)}
                    className={`flex-1 rounded-lg py-2 text-xs transition-colors ${
                      (selected?.rule || "") === o.value
                        ? "bg-blue-500/40 text-white border border-cyan-400/60"
                        : "glass-card text-blue-300 hover:text-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All cells list */}
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h2 className="text-white font-semibold text-sm mb-4">
              Semua Label Sel
            </h2>
            <div className="space-y-2">
              {cells.map((cell) => {
                const isFree = isFreeCell(cell);
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
                        ⭐ {cell.label} — sel gratis di tengah (tidak dapat diubah)
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={cell.label}
                          onChange={(e) => updateLabel(cell.id, e.target.value)}
                          onFocus={() => setSelectedCell(cell.id)}
                          className="flex-1 min-w-0 glass-input rounded-lg px-3 py-1.5 text-white text-sm"
                          placeholder={`Label sel ${cell.id + 1}...`}
                          maxLength={80}
                        />
                        <select
                          value={cell.rule || ""}
                          onChange={(e) => updateRule(cell.id, e.target.value)}
                          className="glass-input rounded-lg px-2 py-1.5 text-white text-xs flex-shrink-0"
                          style={{ colorScheme: "dark" }}
                        >
                          {RULE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          {ruleError && <p className="text-red-300 text-xs mb-2">{ruleError}</p>}
          <div className="sticky bottom-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !!timeError || !!ruleError}
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
