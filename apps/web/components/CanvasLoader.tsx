"use client";

import { useProgress } from "@react-three/drei";

export function CanvasLoader() {
  const { active, progress } = useProgress();

  if (!active && progress === 100) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05010a] backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 w-full max-w-xs px-8">
        <div className="w-16 h-16 border-2 border-brand-primary/20 rounded-none animate-ping absolute" />
        <div className="w-16 h-16 border-t-2 border-brand-primary rounded-none animate-spin z-10" />

        <div className="w-full mt-4 space-y-2">
          <div className="h-1 w-full bg-white/5 border border-white/10 overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-brand-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-xs font-medium text-brand-primary/80 uppercase tracking-widest">
            Loading Assets {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
}
