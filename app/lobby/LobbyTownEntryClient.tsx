"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTownPreload } from "@/hooks/useTownPreload";

type LobbyTownEntryClientProps = {
  townHref: string;
  glbAssets: string[];
  staticAssets: string[];
};

export function LobbyTownEntryClient({ townHref, glbAssets, staticAssets }: LobbyTownEntryClientProps) {
  const router = useRouter();

  const { status, progress, error, retry } = useTownPreload({
    townHref,
    glbAssets,
    staticAssets,
    enabled: true,
    buildVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local",
    prefetchRoute: router.prefetch,
  });

  const canEnterTown = status === "ready";

  return (
    <div className="mt-8">
      <Button
        disabled={!canEnterTown}
        onClick={() => {
          if (!canEnterTown) return;
          router.push(townHref);
        }}
        className="w-full py-8 text-xl font-bold bg-brand-secondary hover:bg-brand-secondary/80 text-brand-neutral rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,184,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ENTER TOWN
      </Button>

      <div className="mt-4 h-14">
        {(status === "preloading" || status === "ready") && (
          <div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-gray-400 uppercase tracking-widest">
                {status === "ready" ? "Assets Ready" : "Loading City"}
              </span>
              <span className="text-brand-secondary font-bold">{progress}%</span>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-left text-xs text-red-300 border border-red-300/40 bg-red-500/10 rounded-lg p-3">
            <p>City assets failed to load. Check connection and retry.</p>
            <p className="mt-1 text-red-200/90">{error}</p>
            <Button
              onClick={retry}
              variant="outline"
              className="mt-2 h-7 px-3 text-xs border-red-300/50 text-red-100 hover:bg-red-400/20"
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
