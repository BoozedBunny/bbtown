import Link from "next/link";
import { NewsFeedSurface } from "@/components/NewsFeedSurface";

export default async function TownNewsPage({
  params,
}: {
  params: Promise<{ townId: string }>;
}) {
  const { townId } = await params;

  return (
    <main className="min-h-screen bg-[#05010a] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Town News Desk</h1>
            <p className="text-sm text-gray-400">Town Wire + Channel BB editorial feed</p>
          </div>
          <Link href={`/town/${townId}`} className="text-sm text-gray-300 hover:text-white underline underline-offset-4">
            Back to town
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f021a] p-4 md:p-6 h-[78vh]">
          <NewsFeedSurface mode="page" townId={townId} />
        </div>
      </div>
    </main>
  );
}
