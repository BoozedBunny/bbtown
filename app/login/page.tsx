"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (username: string) => {
    // Simple mock auth: set a cookie
    document.cookie = `mock_user=${username}; path=/; max-age=3600`;
    router.push("/lobby");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-neutral text-white overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary opacity-20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary opacity-10 blur-[120px] rounded-full" />

      <div className="z-10 p-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
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

        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Powered by BoozedBunny
          </p>
        </div>
      </div>
    </div>
  );
}
