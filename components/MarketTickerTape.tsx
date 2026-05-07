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
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-40 border-t border-brand-primary/30 bg-black/80 backdrop-blur-md overflow-hidden h-10 flex items-center">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-primary to-transparent opacity-50" />
      <div className="group relative flex w-max min-w-full animate-[ticker_45s_linear_infinite] hover:[animation-play-state:paused]">
        {duplicatedRows.map((row, index) => {
          const up = row.trend === "UP";
          const down = row.trend === "DOWN";
          return (
            <button
              key={`${row.symbol}-${index}`}
              onClick={() => onSelectSymbol(row.symbol)}
              className="px-6 h-10 text-[10px] font-black font-mono whitespace-nowrap border-r border-white/5 hover:bg-brand-primary/10 transition-all group/item"
            >
              <span className="text-white group-hover/item:text-brand-primary transition-colors mr-3 uppercase tracking-widest">{row.symbol}</span>
              <span className="text-gray-400 mr-3 font-bold">${row.price.toFixed(2)}</span>
              <span className={`px-2 py-0.5 cyber-skew ${up ? "bg-brand-secondary/20 text-brand-secondary" : down ? "bg-brand-tertiary/20 text-brand-tertiary" : "bg-white/5 text-gray-500"}`}>
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
