import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import logo from "../../public/logo.png";
import ids from "../../public/ids.png";
import entitasLogo from "../../public/entitas.png";
import danantara from "../../public/danantara.png";
import { ENTITIES } from "../lib/bingo";
import { api, getSession, signInWithGoogle, supabase } from "../lib/supabase";
import GoogleButton from "../components/GoogleButton";

// step: "checking" → "signin" (no session) → "profile" (signed in, no profile) → /bingo
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState("checking");
  const [name, setName] = useState("");
  const [entitas, setEntitas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkProfile = async () => {
    try {
      const data = await api("/api/me");
      if (data.profile) {
        router.replace("/bingo");
        return;
      }
      setName(data.suggestedName);
      setStep("profile");
    } catch {
      setStep("signin");
    }
  };

  useEffect(() => {
    getSession().then((session) => (session ? checkProfile() : setStep("signin")));
  }, []);

  const handleGoogle = async () => {
    setError("");
    const { error } = await signInWithGoogle("/");
    if (error) setError("Gagal masuk dengan Google. Coba lagi.");
  };

  const handleGuest = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase().auth.signInAnonymously();
    setLoading(false);
    if (error) {
      setError("Gagal masuk sebagai tamu. Coba lagi.");
      return;
    }
    setStep("profile");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !entitas) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/me", { method: "POST", body: { name: name.trim(), entitas } });
      router.push("/bingo");
    } catch {
      setError("Gagal mendaftar. Coba lagi.");
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await supabase().auth.signOut();
    setName("");
    setStep("signin");
  };

  if (step === "checking") {
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
            <Image src={logo} alt="IDSurvey Logo" width={400} height={400} priority />
          </div>

          <div className="glass-card rounded-2xl p-8 shadow-2xl">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            {step === "signin" ? (
              <>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Masuk untuk bermain
                </h2>
                <p className="text-blue-300/70 text-sm mb-6">
                  Progres bingo kamu tersimpan di akunmu
                </p>
                <GoogleButton onClick={handleGoogle} disabled={loading} />
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-blue-400/60 text-xs">atau</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  onClick={handleGuest}
                  disabled={loading}
                  className="w-full glass-card rounded-xl py-3.5 text-blue-200 text-sm font-semibold hover:text-white transition-colors"
                >
                  {loading ? "Memproses..." : "Main sebagai Tamu"}
                </button>
                <p className="text-blue-400/60 text-xs mt-3 text-center">
                  Progres tamu hanya tersimpan di perangkat ini. Kamu bisa
                  menghubungkan Google nanti.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Daftarkan dirimu
                </h2>
                <p className="text-blue-300/70 text-sm mb-6">
                  Masukkan data untuk mulai bermain
                </p>

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
                      className="w-full glass-input rounded-xl px-4 py-3 text-white placeholder-blue-400/50 text-base"
                      maxLength={100}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-blue-200 text-sm font-medium mb-2">
                      Entitas
                    </label>
                    <select
                      value={entitas}
                      onChange={(e) => setEntitas(e.target.value)}
                      className="w-full glass-input rounded-xl px-4 py-3 text-base"
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
                <button
                  onClick={handleSwitchAccount}
                  className="w-full text-center text-blue-400/70 hover:text-white text-xs mt-4"
                >
                  Gunakan akun lain
                </button>
              </>
            )}
          </div>

          {/* Footer logos */}
          <div className="flex items-center justify-between gap-5 bg-white rounded-xl p-4 mt-8 w-full sm:flex-row flex-col">
            <Image src={danantara} alt="Danantara Logo" className="h-8 w-auto object-contain" />
            <Image src={ids} alt="IDSurvey Logo" className="h-8 w-auto object-contain" />
            <Image src={entitasLogo} alt="Entitas Logo" className="h-8 w-auto object-contain" />
          </div>
        </div>
      </div>
    </>
  );
}
