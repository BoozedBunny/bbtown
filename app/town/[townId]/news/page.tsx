import Link from "next/link";
import { NewsFeedSurface } from "@/components/NewsFeedSurface";

export default async function TownNewsPage({
  params,
}: {
  params: Promise<{ townId: string }>;
}) {
  const { townId } = await params;

  return (
    <main className="min-h-screen bg-[#05010a] text-white p-6 md:p-10 brand-bg-overlay font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 cyber-panel p-6 border-l-4 border-l-brand-primary">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter cyber-glitch-text" data-text="NEURAL_NEWS_DESK">NEURAL_NEWS_DESK</h1>
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-gray-500 mt-1">Encrypted Broadcast // Node: {townId}</p>
          </div>
          <Link href={`/town/${townId}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-brand-secondary transition-colors">
            [ RET_TO_DISTRICT ]
          </Link>
        </div>

        <div className="cyber-panel p-4 md:p-8 h-[75vh] border-t-2 border-t-brand-secondary/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-secondary/50 to-transparent" />
          <NewsFeedSurface mode="page" townId={townId} />
        </div>
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-20 bg-[length:100%_2px,3px_100%] opacity-40" />
    </main>
  );
}
