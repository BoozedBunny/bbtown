"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { isEmailWhitelisted } from "@/lib/emailWhitelist";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [gameName, setGameName] = useState("BoozedBunnyTown");
  const [loginHeadline, setLoginHeadline] = useState("Welcome to the Town");
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/cms/global-setting", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          setting?: { gameName?: string; loginHeadline?: string };
        };

        if (payload.setting?.gameName) setGameName(payload.setting.gameName);
        if (payload.setting?.loginHeadline) setLoginHeadline(payload.setting.loginHeadline);
      } catch {
        // keep fallback labels
      }
    };

    void loadSettings();
  }, []);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Login failed");
      }

      router.push("/lobby");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!isEmailWhitelisted(trimmedEmail)) {
      setError("Registration is only allowed with well-known email providers (e.g. Gmail, Yahoo, Hotmail, Outlook, GMX, Web.de).");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email: trimmedEmail, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Registration failed");
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        requiresConfirmation?: boolean;
        user?: { id: number; username: string };
      };

      if (payload.requiresConfirmation) {
        setSuccessMessage("Registration successful! A confirmation link has been sent to your email. Please click it to verify your account.");
        
        // Save credentials temporarily in session storage to enable auto-login upon confirmation
        try {
          sessionStorage.setItem("bbtown_pending_login", JSON.stringify({
            identifier: trimmedEmail,
            password: password
          }));
        } catch {
          // ignore storage block
        }

        setUsername("");
        setEmail("");
        setPassword("");
      } else {
        router.push("/lobby");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-login or verify toast detection when redirected back with ?verified=true
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verified") === "true") {
        // Remove the parameter from URL to prevent infinite loops / triggering on reload
        router.replace("/login");

        const pending = sessionStorage.getItem("bbtown_pending_login");
        if (pending) {
          try {
            const { identifier, password } = JSON.parse(pending);
            sessionStorage.removeItem("bbtown_pending_login");

            setSuccessMessage("Email verified successfully! Logging you in automatically...");
            setIsSubmitting(true);

            void fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifier, password }),
            }).then(async (res) => {
              if (res.ok) {
                router.push("/lobby");
                router.refresh();
              } else {
                const payload = (await res.json()) as { error?: string };
                setError(payload.error ?? "Auto-login failed. Please sign in manually.");
                setSuccessMessage(null);
                setIsSubmitting(false);
              }
            }).catch(() => {
              setError("Auto-login failed. Please sign in manually.");
              setSuccessMessage(null);
              setIsSubmitting(false);
            });
          } catch {
            sessionStorage.removeItem("bbtown_pending_login");
            setSuccessMessage("Account successfully verified! Please log in.");
          }
        } else {
          setSuccessMessage("Account successfully verified! Please log in.");
        }
      }
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white overflow-hidden relative brand-bg-overlay font-sans">
      <div className="z-10 p-10 cyber-panel w-full max-w-md border-t-4 border-t-brand-primary">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full animate-pulse" />
            <Image
              src="https://www.boozedbunnytown.com/media/logo.png"
              alt="BoozedBunny Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(189,0,255,0.5)] relative z-10"
            />
          </div>
          <h1 className="text-4xl font-heading font-black tracking-tighter mb-2 cyber-glitch-text italic" data-text={gameName}>
            {gameName}
          </h1>
          <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">{loginHeadline}</p>
        </div>

        {successMessage ? (
          <div className="space-y-6 text-center">
            <div className="border border-green-500/30 bg-green-500/5 p-4 rounded text-sm text-green-400 font-mono leading-relaxed shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              {successMessage}
            </div>
            <button
              className="w-full bg-brand-primary hover:bg-brand-secondary transition-colors p-3 text-sm font-black uppercase tracking-[0.2em] shadow-[0_0_10px_rgba(189,0,255,0.3)]"
              onClick={() => {
                setSuccessMessage(null);
                setMode("login");
              }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-2">
              <button className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] ${mode === "login" ? "bg-brand-primary text-white" : "bg-black/40 border border-white/20"}`} onClick={() => { setMode("login"); setError(null); }}>Login</button>
              <button className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] ${mode === "register" ? "bg-brand-primary text-white" : "bg-black/40 border border-white/20"}`} onClick={() => { setMode("register"); setError(null); }}>Register</button>
            </div>

            {mode === "login" ? (
              <form className="space-y-4" onSubmit={submitLogin}>
                <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Username or Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
                <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="w-full bg-brand-primary p-3 text-sm font-black uppercase tracking-[0.2em]" disabled={isSubmitting}>{isSubmitting ? "Please wait..." : "Sign in"}</button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={submitRegister}>
                <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <div>
                  <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <p className="text-[10px] text-gray-500 font-mono mt-1 px-1">
                    * Please use a well-known provider (Gmail, Yahoo, Hotmail, GMX, Web.de, etc.)
                  </p>
                </div>
                <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="w-full bg-brand-primary p-3 text-sm font-black uppercase tracking-[0.2em]" disabled={isSubmitting}>{isSubmitting ? "Please wait..." : "Create account"}</button>
              </form>
            )}

            {error ? <p className="mt-4 text-xs text-red-400 font-mono border border-red-500/20 bg-red-500/5 p-3 rounded">{error}</p> : null}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 text-center flex flex-col items-center gap-4">
          <Link href="/about" className="text-brand-primary hover:text-brand-secondary transition-colors text-sm font-bold underline decoration-brand-primary/50 underline-offset-4">
            What is BoozedBunnyTown?
          </Link>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
