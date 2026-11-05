import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { api, getSession, isTransient, signInWithGoogle, supabase } from "../lib/supabase";
import GoogleButton from "../components/GoogleButton";
import Logo from "../components/Logo";

const ERROR_TEXT = {
  alias_taken: "Alias ini sudah dipakai pemain lain. Coba alias lain.",
};

// step: "checking" → "signin" (no session) → "profile" (signed in, no alias yet) → /bingo
//       "offline" when the check itself fails because of bad signal
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState("checking");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkProfile = async () => {
    try {
      const data = await api("/api/me");
      if (data.profile) {
        router.replace("/bingo");
        return;
      }
      setStep("profile");
    } catch (err) {
      setStep(isTransient(err) ? "offline" : "signin");
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
    if (!alias.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/me", { method: "POST", body: { name: alias.trim() }, retries: 2 });
      router.push("/bingo");
    } catch (err) {
      setError(
        ERROR_TEXT[err.message] ||
          (isTransient(err) ? "Sinyal lemah. Coba lagi sebentar." : "Gagal menyimpan alias. Coba lagi."),
      );
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await supabase().auth.signOut();
    setAlias("");
    setStep("signin");
  };

  if (step === "offline") {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-6 text-center max-w-xs fade-in">
          <div className="text-4xl mb-2">📶</div>
          <p className="text-slate-800 font-extrabold">Sinyal lemah</p>
          <p className="text-slate-500 text-sm mt-1">Tidak bisa terhubung ke server.</p>
          <button
            onClick={() => {
              setStep("checking");
              checkProfile();
            }}
            className="btn-primary rounded-xl px-6 py-2.5 text-white font-extrabold text-sm mt-4"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (step === "checking") {
    return (
      <div className="bingo-bg min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Piknik Bingo</title>
      </Head>
      <div className="bingo-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md fade-in">
          {/* Branding */}
          <div className="text-center mb-8">
            <Logo size="lg" />
            <p className="inline-block mt-3 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-extrabold tracking-wide">
              PIKNIK DTI 2026 · GARUT
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Foto-foto seru, isi papanmu, kejar Bingo!
            </p>
          </div>

          <div className="glass-card rounded-3xl p-7">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">
                {error}
              </div>
            )}

            {step === "signin" ? (
              <>
                <h2 className="text-lg font-extrabold text-slate-800 mb-1">
                  Masuk untuk bermain
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Progres bingo kamu tersimpan di akunmu
                </p>
                <GoogleButton onClick={handleGoogle} disabled={loading} />
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-slate-400 text-xs">atau</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <button
                  onClick={handleGuest}
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 bg-amber-50 border-2 border-amber-200 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-colors"
                >
                  {loading ? "Memproses..." : "Main sebagai Tamu"}
                </button>
                <p className="text-slate-400 text-xs mt-3 text-center">
                  Progres tamu hanya tersimpan di perangkat ini. Kamu bisa
                  menghubungkan Google nanti.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-extrabold text-slate-800 mb-1">
                  Pilih alias kamu
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Alias ini yang tampil di papan dan leaderboard
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="mis. Si Paling Garut"
                    className="w-full glass-input rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 text-base"
                    maxLength={30}
                    autoComplete="nickname"
                    autoFocus
                    required
                  />

                  <button
                    type="submit"
                    disabled={loading || !alias.trim()}
                    className="btn-primary w-full rounded-xl py-3.5 text-white font-extrabold text-base"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Menyimpan...
                      </span>
                    ) : (
                      "Mulai Bermain! 🚀"
                    )}
                  </button>
                </form>
                <button
                  onClick={handleSwitchAccount}
                  className="w-full text-center text-slate-400 hover:text-slate-700 text-xs mt-4"
                >
                  Gunakan akun lain
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
