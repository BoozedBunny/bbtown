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
    <div className="flex flex-col items-center justify-center min-h-screen text-white overflow-hidden relative brand-bg-overlay">
      <div className="z-10 p-10 glass-card w-full max-w-md">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="relative w-32 h-32 mb-6 animate-pulse">
            <Image
              src="/logo.png"
              alt="BoozedBunny Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(189,0,255,0.5)]"
            />
          </div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2 brand-gradient-text">
            BoozedBunnyTown
          </h1>
          <p className="text-gray-400 font-sans">Enter the next generation of building</p>
        </div>

        <div className="space-y-4 mt-8">
          <Button
            onClick={() => handleLogin("Player1")}
            className="w-full py-6 text-lg font-bold bg-brand-primary hover:bg-brand-primary/80 transition-all duration-300 shadow-[0_0_20px_rgba(189,0,255,0.3)] hover:shadow-[0_0_30px_rgba(189,0,255,0.5)]"
          >
            Login as Player 1
          </Button>
          <Button
            onClick={() => handleLogin("Player2")}
            variant="outline"
            className="w-full py-6 text-lg font-bold border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-brand-neutral transition-all duration-300"
          >
            Login as Player 2
          </Button>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
            Powered by
          </p>
          <div className="relative w-24 h-8 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
             <Image
              src="/logo.png"
              alt="BoozedBunny Logo"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
