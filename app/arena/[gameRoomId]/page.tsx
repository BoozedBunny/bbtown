"use client";

import { use } from "react";
import { Loader2 } from "lucide-react";

export default function ArenaPage({
  params,
}: {
  params: Promise<{ gameRoomId: string }>;
}) {
  const { gameRoomId } = use(params);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-neutral text-white font-sans overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary opacity-10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary opacity-10 blur-[120px] rounded-full" />

      <div className="z-10 flex flex-col items-center max-w-md w-full bg-white/5 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-2xl text-center">
        <div className="w-20 h-20 bg-brand-primary/20 rounded-2xl flex items-center justify-center mb-8 animate-pulse">
          <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        </div>

        <h1 className="text-3xl font-heading font-bold mb-4 bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
          Arena Session
        </h1>

        <p className="text-gray-400 text-lg mb-8">
          Joining game room: <span className="text-brand-secondary font-mono font-bold">{gameRoomId}</span>
        </p>

        <div className="space-y-4 w-full">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-gray-300">
              Initializing 3D environment...
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-gray-300">
              Synchronizing players...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
