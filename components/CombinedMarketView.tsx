"use client";

import { useEffect, useMemo, useState } from "react";
import { Socket } from "socket.io-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";

type Stock = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
  sector?: string;
  exchange?: string;
  marketCapBand?: string;
  changeAbs?: number;
  changePct?: number;
  trend?: "UP" | "DOWN" | "FLAT";
};

type PortfolioItem = {
  id: string;
  stockId: string;
  quantity: number;
  stock: Stock;
};

type Snapshot = {
  profile: {
    sector: string;
    exchange: string;
    marketCapBand: string;
    volatilityClass: string;
    description: string;
    hqRegion: string;
  };
  stats: {
    dayHigh: number;
    dayLow: number;
    dayRangePct: number;
    lastUpdatedAt: string;
  };
  news: Array<{ id: string; tone: "UP" | "DOWN" | "FLAT"; headline: string; body: string; timestampLabel: string }>;
};

const CHART_STROKE_UP = "#2dd4bf";
const CHART_STROKE_DOWN = "#fb7185";

export function CombinedMarketView({
  socket,
  open,
  setOpen,
  townData,
  preselectedSymbol,
  onPreselectedSymbolConsumed,
}: {
  socket: Socket | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  townData: any;
  preselectedSymbol?: string | null;
  onPreselectedSymbolConsumed?: () => void;
}) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [wallet, setWallet] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [pRes, sRes, meRes] = await Promise.all([fetch("/api/portfolio"), fetch("/api/stocks"), fetch("/api/me")]);
      if (pRes.ok) setPortfolio(await pRes.json());
      if (sRes.ok) setStocks(await sRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setWallet(me.wallet);
      }
    };
    if (open) fetchData();
  }, [open]);

  useEffect(() => {
    if (!socket) return;

    const onStocksUpdated = (updatedStocks: Stock[]) => {
      setStocks(updatedStocks);
      if (selectedStock) {
        const updated = updatedStocks.find((s) => s.id === selectedStock.id);
        if (updated) setSelectedStock(updated);
      }
    };

    const onPortfolioUpdated = ({ message, type }: { message?: string; type?: string }) => {
      fetch("/api/portfolio").then((res) => res.json()).then(setPortfolio);
      fetch("/api/me").then((res) => res.json()).then((data) => setWallet(data.wallet));
      if (message) {
        if (type === "success") toast.success(message);
        else if (type === "error") toast.error(message);
        else toast(message);
      }
    };

    socket.on("stocks_updated", onStocksUpdated);
    socket.on("portfolio_updated", onPortfolioUpdated);
    return () => {
      socket.off("stocks_updated", onStocksUpdated);
      socket.off("portfolio_updated", onPortfolioUpdated);
    };
  }, [socket, selectedStock]);

  useEffect(() => {
    if (!selectedStock) return;

    Promise.all([
      fetch(`/api/stocks/history/${selectedStock.symbol}`).then((res) => res.json()),
      fetch(`/api/stocks/${selectedStock.symbol}/snapshot`).then((res) => (res.ok ? res.json() : null)),
    ]).then(([historyData, snapshotData]) => {
      setHistory(
        historyData.map((h: any, index: number) => ({
          time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          rawTime: h.timestamp,
          price: h.price,
          index,
        })),
      );
      setSnapshot(snapshotData);
    });
  }, [selectedStock]);

  useEffect(() => {
    if (!open || !preselectedSymbol || stocks.length === 0) return;
    const match = stocks.find((stock) => stock.symbol === preselectedSymbol);
    if (match) {
      setSelectedStock(match);
    } else {
      toast.error("Symbol unavailable");
    }
    onPreselectedSymbolConsumed?.();
  }, [open, preselectedSymbol, stocks, onPreselectedSymbolConsumed]);

  const buy = (symbol: string, quantity: number) => socket?.emit("buy_stock", { symbol, quantity });
  const sell = (symbol: string, quantity: number) => socket?.emit("sell_stock", { symbol, quantity });

  const currentHolding = useMemo(() => {
    if (!selectedStock) return 0;
    return portfolio.find((p) => p.stockId === selectedStock.id)?.quantity || 0;
  }, [portfolio, selectedStock]);

  const lineStroke = (selectedStock?.price ?? 0) >= (selectedStock?.previousPrice ?? 0) ? CHART_STROKE_UP : CHART_STROKE_DOWN;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[880px] h-[720px] bg-[#0f021a] text-white border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden overflow-x-clip flex flex-col">
        <Tabs defaultValue="treasury" className="w-full h-full flex flex-col overflow-x-clip">
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

          <div className="flex-1 overflow-y-auto overflow-x-clip p-6">
            <TabsContent value="treasury" className="mt-0 space-y-6">
              <div className="p-8 bg-brand-primary/10 rounded-3xl border border-brand-primary/20 text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-brand-primary/20 rounded-2xl flex items-center justify-center border border-brand-primary/30"><Wallet className="w-10 h-10 text-brand-secondary" /></div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">City Treasury</h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">The financial heartbeat of BoozedBunnyTown.</p>
                </div>
                <div className="p-6 bg-black/40 rounded-2xl border border-white/5 max-w-sm mx-auto">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2 text-center">Global Bank Balance</span>
                  <span className="text-4xl font-bold text-brand-secondary block text-center tracking-tight">${townData?.bankBalance?.toLocaleString() || 0}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="market" className="mt-0">
              {!selectedStock ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3"><Wallet className="text-brand-secondary" /><div><div className="text-[10px] text-gray-400 uppercase font-bold">Available Cash</div><div className="text-lg font-bold text-white">${wallet.toLocaleString()}</div></div></div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3"><ShoppingBag className="text-brand-primary" /><div><div className="text-[10px] text-gray-400 uppercase font-bold">Total Assets</div><div className="text-lg font-bold text-white">{portfolio.length} Companies</div></div></div>
                  </div>

                  <div className="grid gap-3">
                    {stocks.map((stock) => {
                      const diff = stock.price - stock.previousPrice;
                      const isUp = diff >= 0;
                      const owned = portfolio.find((p) => p.stockId === stock.id)?.quantity || 0;
                      return (
                        <button key={stock.id} onClick={() => setSelectedStock(stock)} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group text-left">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${isUp ? "bg-brand-secondary/10" : "bg-brand-tertiary/10"}`}>{isUp ? <ArrowUpCircle className="text-brand-secondary" /> : <ArrowDownCircle className="text-brand-tertiary" />}</div>
                            <div>
                              <div className="font-bold text-lg group-hover:text-brand-primary transition-colors flex items-center gap-2">{stock.symbol}{owned > 0 && <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full border border-brand-primary/30 font-bold">{owned} Owned</span>}</div>
                              <div className="text-xs text-gray-400">{stock.name} • {(stock.sector ?? "General")}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xl font-bold">${stock.price.toFixed(2)}</div>
                            <div className={`text-xs font-bold ${isUp ? "text-brand-secondary" : "text-brand-tertiary"}`}>{isUp ? "▲" : "▼"} {Math.abs(diff).toFixed(2)} ({stock.previousPrice > 0 ? ((Math.abs(diff) / stock.previousPrice) * 100).toFixed(2) : 0}%)</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300 overflow-x-clip">
                  <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)} className="text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" />Back to Market</Button>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{selectedStock.symbol} <span className="text-sm text-gray-400">{snapshot?.profile.exchange ?? "BBX"}</span></div>
                      <div className="text-xs text-gray-400">{selectedStock.name} • {snapshot?.profile.sector ?? selectedStock.sector ?? "General"}</div>
                    </div>
                  </div>

                  <div className="h-[260px] w-full bg-white/5 rounded-2xl border border-white/10 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 8, right: 16, left: 6, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={28} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={64} />
                        <Tooltip
                          cursor={{ stroke: "rgba(148,163,184,0.6)", strokeDasharray: "4 4" }}
                          contentStyle={{ backgroundColor: "#11041d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                          formatter={(value: any, _name, payload: any) => {
                            const current = Number(value);
                            const previous = payload && payload.payload && payload.payload.index > 0 ? history[payload.payload.index - 1]?.price ?? current : current;
                            const delta = current - previous;
                            const deltaPct = previous > 0 ? (delta / previous) * 100 : 0;
                            return [`$${current.toFixed(2)} (${delta >= 0 ? "+" : ""}${delta.toFixed(2)} / ${deltaPct.toFixed(2)}%)`, "Price"];
                          }}
                          labelFormatter={(label) => `Time: ${label}`}
                        />
                        <Line type="monotone" dataKey="price" stroke={lineStroke} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10"><div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Current Price</div><div className="text-3xl font-mono font-bold text-brand-secondary">${selectedStock.price.toFixed(2)}</div></div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10"><div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Your Holdings</div><div className="text-3xl font-mono font-bold text-white">{currentHolding} Shares</div><div className="text-[10px] text-gray-500 font-bold mt-1">Value: ${(currentHolding * selectedStock.price).toFixed(2)}</div></div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <div className="text-xs text-gray-300">{snapshot?.profile.description ?? "Fictional listed company in BBTown market."}</div>
                    <div className="text-[11px] text-gray-400">HQ: {snapshot?.profile.hqRegion ?? "Central District"} • Cap: {snapshot?.profile.marketCapBand ?? "MID"} • Day range: {snapshot?.stats?.dayRangePct?.toFixed(2) ?? "0.00"}%</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-gray-500 font-bold">Market News (BBX Desk)</div>
                    {(snapshot?.news ?? []).map((item) => (
                      <div key={item.id} className="p-3 rounded-xl bg-black/30 border border-white/10">
                        <div className="flex justify-between text-xs"><span className={item.tone === "UP" ? "text-brand-secondary" : item.tone === "DOWN" ? "text-brand-tertiary" : "text-slate-300"}>{item.headline}</span><span className="text-gray-500">{item.timestampLabel}</span></div>
                        <div className="text-xs text-gray-300 mt-1">{item.body}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <Button onClick={() => buy(selectedStock.symbol, 1)} className="bg-brand-secondary hover:bg-brand-secondary/80 text-black font-bold h-12 rounded-xl">BUY SHARES</Button>
                    <Button onClick={() => sell(selectedStock.symbol, 1)} disabled={currentHolding === 0} className="bg-brand-tertiary hover:bg-brand-tertiary/80 text-white font-bold h-12 rounded-xl disabled:opacity-30">SELL SHARES</Button>
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
