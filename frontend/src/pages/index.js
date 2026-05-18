import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Head from "next/head";
import Image from "next/image";
import logo from "../../public/logo.png";
import ids from "../../public/ids.png";
import entitasLogo from "../../public/entitas.png";
import danantara from "../../public/danantara.png";

const ENTITIES = ["PT ID Survey", "PT SUCOFINDO", "PT SI", "PT BKI"];
const API = "";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entitas, setEntitas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("bingo_user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.userId && u?.name && u?.entitas) {
        router.replace("/bingo");
        return;
      }
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !entitas) return;
    setLoading(true);
    setError("");
    try {
      const existing = localStorage.getItem("bingo_user");
      const existingId = existing ? JSON.parse(existing).userId : null;
      const { data } = await axios.post(`${API}/api/register`, {
        userId: existingId,
        name: name.trim(),
        entitas,
      });
      localStorage.setItem(
        "bingo_user",
        JSON.stringify({
          userId: data.userId,
          name: name.trim(),
          entitas,
        }),
      );
      router.push("/bingo");
    } catch (err) {
      setError("Gagal mendaftar. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="grid-overlay" />
        <div className="relative z-10">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>IDSurvey FIRST Summit '26 — Bingo</title>
      </Head>
      <div className="bingo-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="grid-overlay" />

        <div className="relative z-10 w-full max-w-md fade-in">
          {/* Branding */}
          <div className="text-center mb-10">
            <Image src={logo} alt="IDSurvey Logo" width={400} height={400} />
          </div>

          {/* Form card */}
          <div className="glass-card rounded-2xl p-8 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">
              Daftarkan dirimu
            </h2>
            <p className="text-blue-300/70 text-sm mb-6">
              Masukkan data untuk mulai bermain
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-blue-200 text-sm font-medium mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama kamu"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white placeholder-blue-400/50 text-sm"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-blue-200 text-sm font-medium mb-2">
                  Entitas
                </label>
                <select
                  value={entitas}
                  onChange={(e) => setEntitas(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                  style={{ color: entitas ? "white" : "rgba(147,197,253,0.5)" }}
                  required
                >
                  <option value="" disabled>
                    Pilih entitas kamu...
                  </option>
                  {ENTITIES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !entitas}
                className="btn-primary w-full rounded-xl py-3.5 text-white font-semibold text-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mendaftar...
                  </span>
                ) : (
                  "Mulai Bermain Bingo!"
                )}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div className="flex items-center justify-between gap-5 bg-white rounded-xl p-4 mt-8 w-full sm:flex-row flex-col">
            <Image
              src={danantara}
              alt="Danantara Logo"
              className="h-8 w-auto object-contain"
            />
            <Image
              src={ids}
              alt="IDSurvey Logo"
              className="h-8 w-auto object-contain"
            />
            <Image
              src={entitasLogo}
              alt="Entitas Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </>
  );
}
