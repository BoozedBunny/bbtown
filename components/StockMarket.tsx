"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Stock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
}

export function StockMarket({ socket }: { socket: Socket | null }) {
  const [open, setOpen] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);

  useEffect(() => {
    if (!socket) return;
    
    // Initial fetch
    fetch("/api/stocks").then(res => res.json()).then(data => {
      setStocks(data);
    }).catch(console.error);

    socket.on("stocks_updated", (updatedStocks) => {
      setStocks(updatedStocks);
    });

    return () => {
      socket.off("stocks_updated");
    };
  }, [socket]);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all border border-brand-primary/50 text-brand-primary hover:bg-brand-primary/20"
      >
        📈 Stock Market
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] bg-[#11041d] text-white border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-brand-secondary flex items-center gap-2">
              <span className="text-3xl">📈</span> Funny Names Exchange
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {stocks.length === 0 ? (
              <p className="text-center text-gray-400">Loading stocks...</p>
            ) : (
              stocks.map(stock => {
                const diff = stock.price - stock.previousPrice;
                const isUp = diff >= 0;
                return (
                  <div key={stock.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                    <div>
                      <div className="font-bold text-lg">{stock.symbol}</div>
                      <div className="text-xs text-gray-400">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-bold">
                        ${stock.price.toFixed(2)}
                      </div>
                      <div className={`text-xs font-bold ${isUp ? 'text-brand-secondary' : 'text-brand-tertiary'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(2)} (
                        {stock.previousPrice > 0 ? ((Math.abs(diff) / stock.previousPrice) * 100).toFixed(2) : 0}%)
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
