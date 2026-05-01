"use client";

import { useEffect, useState, useMemo } from "react";
import { Socket } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, Wallet, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

interface Stock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
}

interface PortfolioItem {
  id: string;
  stockId: string;
  quantity: number;
  stock: Stock;
}

export function StockMarket({ socket }: { socket: Socket | null }) {
  const [open, setOpen] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [wallet, setWallet] = useState<number>(0);

  useEffect(() => {
    // Get username from cookie
    const cookies = document.cookie.split(';');
    const mockUser = cookies.find(c => c.trim().startsWith('mock_user='));
    if (mockUser) setUsername(mockUser.split('=')[1]);

    // Initial fetch for wallet and portfolio
    const fetchData = async () => {
      const pRes = await fetch("/api/portfolio");
      if (pRes.ok) setPortfolio(await pRes.json());

      const sRes = await fetch("/api/stocks");
      if (sRes.ok) setStocks(await sRes.json());

      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const me = await meRes.json();
        setWallet(me.wallet);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("stocks_updated", (updatedStocks: Stock[]) => {
      setStocks(updatedStocks);
      if (selectedStock) {
        const updated = updatedStocks.find(s => s.id === selectedStock.id);
        if (updated) setSelectedStock(updated);
      }
    });

    socket.on("portfolio_updated", ({ username: updatedUser, message, type }: { username: string, message?: string, type?: string }) => {
      if (updatedUser === username) {
        fetch("/api/portfolio").then(res => res.json()).then(setPortfolio);
        fetch("/api/me").then(res => res.json()).then(data => setWallet(data.wallet));

        if (message) {
          if (type === "success") toast.success(message);
          else if (type === "error") toast.error(message);
          else toast(message);
        }
      }
    });

    return () => {
      socket.off("stocks_updated");
      socket.off("portfolio_updated");
    };
  }, [socket, selectedStock, username]);

  useEffect(() => {
    if (selectedStock) {
      fetch(`/api/stocks/history/${selectedStock.symbol}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data.map((h: any) => ({
            time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            price: h.price
          })));
        });
    }
  }, [selectedStock]);

  const buy = (symbol: string, quantity: number) => {
    if (socket && username) {
      socket.emit("buy_stock", { symbol, quantity, username });
    }
  };

  const sell = (symbol: string, quantity: number) => {
    if (socket && username) {
      socket.emit("sell_stock", { symbol, quantity, username });
    }
  };

  const currentHolding = useMemo(() => {
    if (!selectedStock) return 0;
    return portfolio.find(p => p.stockId === selectedStock.id)?.quantity || 0;
  }, [portfolio, selectedStock]);

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
        <DialogContent className="sm:max-w-[700px] h-[600px] bg-[#0f021a] text-white border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-0 flex flex-row justify-between items-center">
            <DialogTitle className="text-2xl font-heading font-bold text-brand-secondary flex items-center gap-2">
              <span className="text-3xl">📈</span> Funny Names Exchange
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {!selectedStock ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                      <Wallet className="text-brand-secondary" />
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Available Cash</div>
                        <div className="text-lg font-bold text-white">${wallet.toLocaleString()}</div>
                      </div>
                   </div>
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                      <ShoppingBag className="text-brand-primary" />
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Total Assets</div>
                        <div className="text-lg font-bold text-white">{portfolio.length} Companies</div>
                      </div>
                   </div>
                </div>

                <div className="grid gap-3">
                  {stocks.map(stock => {
                    const diff = stock.price - stock.previousPrice;
                    const isUp = diff >= 0;
                    return (
                      <button
                        key={stock.id}
                        onClick={() => setSelectedStock(stock)}
                        className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${isUp ? 'bg-brand-secondary/10' : 'bg-brand-tertiary/10'}`}>
                             {isUp ? <ArrowUpCircle className="text-brand-secondary" /> : <ArrowDownCircle className="text-brand-tertiary" />}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-lg group-hover:text-brand-primary transition-colors">{stock.symbol}</div>
                            <div className="text-xs text-gray-400">{stock.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xl font-bold">
                            ${stock.price.toFixed(2)}
                          </div>
                          <div className={`text-xs font-bold ${isUp ? 'text-brand-secondary' : 'text-brand-tertiary'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(2)} ({stock.previousPrice > 0 ? ((Math.abs(diff) / stock.previousPrice) * 100).toFixed(2) : 0}%)
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center">
                   <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)} className="text-gray-400 hover:text-white">
                      ← Back to Market
                   </Button>
                   <div className="text-right">
                      <div className="text-2xl font-bold">{selectedStock.symbol}</div>
                      <div className="text-xs text-gray-400">{selectedStock.name}</div>
                   </div>
                </div>

                <div className="h-[200px] w-full bg-white/5 rounded-2xl border border-white/10 p-4">
                   <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                         <Line type="monotone" dataKey="price" stroke="#BD00FF" strokeWidth={2} dot={false} />
                         <XAxis dataKey="time" hide />
                         <YAxis domain={['auto', 'auto']} hide />
                         <Tooltip
                            contentStyle={{ backgroundColor: '#11041d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            itemStyle={{ color: '#BD00FF' }}
                         />
                      </LineChart>
                   </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Current Price</div>
                      <div className="text-3xl font-mono font-bold text-brand-secondary">${selectedStock.price.toFixed(2)}</div>
                   </div>
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Your Holdings</div>
                      <div className="text-3xl font-mono font-bold text-white">{currentHolding} Shares</div>
                      <div className="text-[10px] text-gray-500 font-bold mt-1">Value: ${(currentHolding * selectedStock.price).toFixed(2)}</div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                   <Button
                      onClick={() => buy(selectedStock.symbol, 1)}
                      className="bg-brand-secondary hover:bg-brand-secondary/80 text-black font-bold h-12 rounded-xl"
                   >
                      BUY SHARES
                   </Button>
                   <Button
                      onClick={() => sell(selectedStock.symbol, 1)}
                      disabled={currentHolding === 0}
                      className="bg-brand-tertiary hover:bg-brand-tertiary/80 text-white font-bold h-12 rounded-xl disabled:opacity-30"
                   >
                      SELL SHARES
                   </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
