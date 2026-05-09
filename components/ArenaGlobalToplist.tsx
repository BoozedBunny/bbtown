import { useEffect, useState } from "react";
import { ToplistEntry } from "@/lib/arena/toplist";

export function ArenaGlobalToplist({
  currentUserUsername,
  localPostMatchRows,
}: {
  currentUserUsername?: string;
  localPostMatchRows?: ToplistEntry[];
}) {
  const [globalToplistRows, setGlobalToplistRows] = useState<ToplistEntry[]>(
    [],
  );
  const [toplistStatus, setToplistStatus] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const fetchToplist = async () => {
      setToplistStatus("loading");
      try {
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch("/api/toplist/global?mode=mp&limit=50", {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Toplist request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;

        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        setGlobalToplistRows(entries);
        setToplistStatus("ready");
      } catch (error) {
        if (!active) return;
        console.warn(
          "Toplist unavailable, falling back to local results",
          error,
        );
        setToplistStatus("unavailable");
      }
    };

    fetchToplist();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const displayRows =
    toplistStatus === "ready" || !localPostMatchRows
      ? globalToplistRows
      : localPostMatchRows;

  return (
    <div className="md:col-span-3 cyber-border bg-black/40 mt-2 overflow-hidden">
      <div className="bg-brand-primary/20 px-6 py-2 border-b border-brand-primary/30 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
          Global Leaderboard Extract
        </span>
        {toplistStatus === "loading" && (
          <div className="w-2 h-2 bg-brand-primary animate-ping" />
        )}
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="bg-white/5 text-left text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3">Pos</th>
              <th className="px-6 py-3">Subject</th>
              <th className="px-6 py-3">Cycles</th>
              <th className="px-6 py-3">Ref</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-gray-500 italic"
                >
                  NO DATA AVAILABLE
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr
                  key={row.playerId}
                  className={`${row.displayName === currentUserUsername ? "bg-brand-primary/20 text-white" : "text-gray-400"} border-t border-white/5`}
                >
                  <td className="px-6 py-2 font-black italic">
                    #{String(row.rank).padStart(2, "0")}
                  </td>
                  <td className="px-6 py-2 font-bold uppercase">
                    {row.displayName}
                  </td>
                  <td className="px-6 py-2">{row.roundsReached}</td>
                  <td className="px-6 py-2 opacity-50">
                    {row.tieBreakReason?.slice(0, 10) ?? "STABLE"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
