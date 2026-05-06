"use client";

import { useEffect, useMemo, useState } from "react";

type TickerRow = {
  symbol: string;
  price: number;
  changePct: number;
  trend: "UP" | "DOWN" | "FLAT";
};

const REFRESH_MS = 12000;

export function MarketTickerTape({ onSelectSymbol }: { onSelectSymbol: (symbol: string) => void }) {
  const [rows, setRows] = useState<TickerRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const res = await fetch("/api/market/ticker");
      if (!res.ok || !mounted) return;
      setRows(await res.json());
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const duplicatedRows = useMemo(() => [...rows, ...rows], [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/65 backdrop-blur-sm overflow-hidden">
      <div className="group relative flex w-max min-w-full animate-[ticker_45s_linear_infinite] hover:[animation-play-state:paused]">
        {duplicatedRows.map((row, index) => {
          const up = row.trend === "UP";
          const down = row.trend === "DOWN";
          return (
            <button
              key={`${row.symbol}-${index}`}
              onClick={() => onSelectSymbol(row.symbol)}
              className="px-4 py-2 text-xs font-mono whitespace-nowrap border-r border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="text-white font-semibold mr-2">{row.symbol}</span>
              <span className="text-slate-300 mr-2">${row.price.toFixed(2)}</span>
              <span className={up ? "text-brand-secondary" : down ? "text-brand-tertiary" : "text-slate-300"}>
                {up ? "▲" : down ? "▼" : "•"}
                {Math.abs(row.changePct).toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
