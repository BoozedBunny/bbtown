"use client";

import { useEffect, useState, useMemo } from "react";
import { Socket } from "socket.io-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, Wallet, ShoppingBag, ArrowLeft } from "lucide-react";
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

export function CombinedMarketView({
  socket,
  open,
  setOpen,
  townData
}: {
  socket: Socket | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  townData: any;
}) {
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
    if (open) fetchData();
  }, [open]);

  useEffect(() => {
    if (!socket) return;

    socket.on("stocks_updated", (updatedStocks: Stock[]) => {
      setStocks(updatedStocks);
      if (selectedStock) {
        const updated = updatedStocks.find(s => s.id === selectedStock.id);
        if (updated) setSelectedStock(updated);
      }
    });

    socket.on("portfolio_updated", ({ message, type }: { message?: string, type?: string }) => {
      fetch("/api/portfolio").then(res => res.json()).then(setPortfolio);
      fetch("/api/me").then(res => res.json()).then(data => setWallet(data.wallet));

      if (message) {
        if (type === "success") toast.success(message);
        else if (type === "error") toast.error(message);
        else toast(message);
      }
    });

    return () => {
      socket.off("stocks_updated");
      socket.off("portfolio_updated");
    };
  }, [socket, selectedStock]);

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
    if (socket) {
      socket.emit("buy_stock", { symbol, quantity });
    }
  };

  const sell = (symbol: string, quantity: number) => {
    if (socket) {
      socket.emit("sell_stock", { symbol, quantity });
    }
  };

  const currentHolding = useMemo(() => {
    if (!selectedStock) return 0;
    return portfolio.find(p => p.stockId === selectedStock.id)?.quantity || 0;
  }, [portfolio, selectedStock]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[750px] h-[650px] bg-[#0f021a] text-white border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden flex flex-col">
        <Tabs defaultValue="treasury" className="w-full h-full flex flex-col">
          <DialogHeader className="p-6 pb-0 flex flex-row justify-between items-center">
            <DialogTitle className="text-2xl font-heading font-bold text-brand-secondary flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-primary rounded-lg rotate-12" />
              BoozedBunnyTown Central
            </DialogTitle>
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger value="treasury" className="data-[state=active]:bg-brand-primary/20 data-[state=active]:text-brand-primary">Treasury</TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-brand-primary/20 data-[state=active]:text-brand-primary">Market</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="treasury" className="mt-0 space-y-6">
              <div className="p-8 bg-brand-primary/10 rounded-3xl border border-brand-primary/20 text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-brand-primary/20 rounded-2xl flex items-center justify-center border border-brand-primary/30">
                   <Wallet className="w-10 h-10 text-brand-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">City Treasury</h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    The financial heartbeat of BoozedBunnyTown. All land taxes and trade fees are collected here to fund infrastructure.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                  <div className="p-6 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2 text-center">Global Bank Balance</span>
                    <span className="text-4xl font-bold text-brand-secondary block text-center tracking-tight">
                      ${townData?.bankBalance?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5">
                   <div className="flex justify-around text-center">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Tax Rate</div>
                        <div className="text-lg font-bold text-white">4.2%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Status</div>
                        <div className="text-lg font-bold text-green-400">Solvent</div>
                      </div>
                   </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="market" className="mt-0">
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
                      const owned = portfolio.find(p => p.stockId === stock.id)?.quantity || 0;
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
                              <div className="font-bold text-lg group-hover:text-brand-primary transition-colors flex items-center gap-2">
                                {stock.symbol}
                                {owned > 0 && <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full border border-brand-primary/30 font-bold">{owned} Owned</span>}
                              </div>
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
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Market
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
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
