"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

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
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Registration failed");
      }

      router.push("/lobby");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <div className="mb-6 flex gap-2">
          <button className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] ${mode === "login" ? "bg-brand-primary text-white" : "bg-black/40 border border-white/20"}`} onClick={() => setMode("login")}>Login</button>
          <button className={`flex-1 py-2 text-xs uppercase tracking-[0.2em] ${mode === "register" ? "bg-brand-primary text-white" : "bg-black/40 border border-white/20"}`} onClick={() => setMode("register")}>Register</button>
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
            <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="w-full bg-black/40 border border-white/20 p-3 text-sm" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="w-full bg-brand-primary p-3 text-sm font-black uppercase tracking-[0.2em]" disabled={isSubmitting}>{isSubmitting ? "Please wait..." : "Create account"}</button>
          </form>
        )}

        {error ? <p className="mt-4 text-xs text-red-400">{error}</p> : null}

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
