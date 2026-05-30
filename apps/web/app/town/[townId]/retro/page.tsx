"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const RetroScene = dynamic(() => import("./RetroScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white font-mono">
      <p>Loading Retro Mode...</p>
    </div>
  ),
});

export default function RetroTownPage({ params }: { params: Promise<{ townId: string }> }) {
  const resolvedParams = use(params);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      <div className="absolute top-4 left-4 z-50">
        <Link href={`/town/${resolvedParams.townId}`}>
          <Button variant="outline" className="bg-black/50 text-white border-white/20 hover:bg-white/20">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Town
          </Button>
        </Link>
      </div>
      <RetroScene townId={resolvedParams.townId} />
    </div>
  );
}
