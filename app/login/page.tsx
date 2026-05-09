"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (username: string) => {
    // Simple mock auth: set a cookie
    document.cookie = `mock_user=${username}; path=/; max-age=3600`;
    router.push("/lobby");
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
          <h1 className="text-4xl font-heading font-black tracking-tighter mb-2 cyber-glitch-text italic" data-text="BoozedBunnyTown">
            BoozedBunnyTown
          </h1>
          <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">Neural Interface v2.0.4</p>
        </div>

        <div className="space-y-6 mt-8">
          <button
            onClick={() => handleLogin("Player1")}
            className="group relative w-full block"
          >
            <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
            <div className="cyber-skew bg-brand-primary px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
               <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Login_as_Player_1</span>
            </div>
          </button>

          <button
            onClick={() => handleLogin("Player2")}
            className="group relative w-full block"
          >
            <div className="absolute inset-0 bg-brand-secondary/10 blur group-hover:bg-brand-secondary/20 transition-all" />
            <div className="cyber-skew bg-black/40 border border-brand-secondary/50 px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
               <span className="text-sm font-black uppercase tracking-[0.2em] text-brand-secondary">Login_as_Player_2</span>
            </div>
          </button>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 text-center flex flex-col items-center gap-2">
          <p className="text-[8px] text-gray-600 uppercase tracking-[0.5em] font-black">
            System Synchronization Active
          </p>
          <div className="flex gap-1">
             {[...Array(6)].map((_, i) => (
               <div key={i} className="w-4 h-[2px] bg-brand-primary/30" />
             ))}
          </div>
        </div>
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
