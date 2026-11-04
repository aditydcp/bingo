import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, getSession, signInWithGoogle, supabase } from "../lib/supabase";
import GoogleButton from "./GoogleButton";

// Renders children only for signed-in users listed in the `admins` table
export default function AdminGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | signin | denied | ok
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session || session.user.is_anonymous) {
        setStatus("signin");
        return;
      }
      setUserInfo({ email: session.user.email, id: session.user.id });
      try {
        await api("/api/admin/me");
        setStatus("ok");
      } catch {
        setStatus("denied");
      }
    })();
  }, []);

  if (status === "ok") return children;

  return (
    <div className="bingo-bg min-h-screen flex items-center justify-center p-4">
      <div className="grid-overlay" />
      <div className="relative z-10 w-full max-w-sm">
        {status === "checking" ? (
          <div className="spinner" />
        ) : (
          <div className="glass-card rounded-2xl p-6 fade-in">
            <h1 className="text-white font-bold text-lg mb-1">Admin</h1>
            {status === "signin" ? (
              <>
                <p className="text-blue-300 text-sm mb-5">
                  Masuk dengan akun Google admin.
                </p>
                <GoogleButton onClick={() => signInWithGoogle(router.asPath)} />
              </>
            ) : (
              <>
                <p className="text-red-300 text-sm mb-3">
                  Akun ini bukan admin.
                </p>
                <p className="text-blue-300/70 text-xs break-all mb-5">
                  {userInfo?.email}
                  <br />
                  ID: {userInfo?.id}
                </p>
                <button
                  onClick={async () => {
                    await supabase().auth.signOut();
                    setStatus("signin");
                  }}
                  className="w-full glass-card rounded-xl py-2.5 text-blue-200 text-sm hover:text-white"
                >
                  Ganti akun
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
