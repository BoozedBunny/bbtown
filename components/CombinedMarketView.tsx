"use client";

import { useEffect, useMemo, useState } from "react";
import { Socket } from "socket.io-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { NewsFeedSurface } from "@/components/NewsFeedSurface";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { CentralManagementIntent, CentralManagementTab } from "@/lib/ui/centralManagementIntent";

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

type TreasurySnapshot = {
  dateKey: string;
  variationAmount: number;
  openingBalance: number;
  closingBalance: number;
};

type LoanState = {
  id: string;
  status: "ACTIVE" | "DELINQUENT" | "PAID" | "DEFAULTED";
  remainingPrincipal: number;
  lateFeesAccrued: number;
  nextDueDateKey: string;
};

const CHART_STROKE_UP = "#2dd4bf";
const CHART_STROKE_DOWN = "#fb7185";

export function CombinedMarketView({
  socket,
  open,
  setOpen,
  townData,
  townId,
  intent,
  onIntentConsumed,
}: {
  socket: Socket | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  townData: any;
  townId: string;
  intent?: CentralManagementIntent | null;
  onIntentConsumed?: () => void;
}) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [wallet, setWallet] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [activeTab, setActiveTab] = useState<CentralManagementTab>("treasury");
  const [treasurySummary, setTreasurySummary] = useState<{ bankBalance: number; todaySnapshot?: TreasurySnapshot; last7Days: TreasurySnapshot[] } | null>(null);
  const [loanState, setLoanState] = useState<LoanState | null>(null);
  const [loanPrincipalInput, setLoanPrincipalInput] = useState(1000);
  const [repayAmountInput, setRepayAmountInput] = useState(100);
  const [loanBusy, setLoanBusy] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const townId = townData?.id ?? 1;
      const [pRes, sRes, meRes, treasuryRes, loanRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/stocks"),
        fetch("/api/me"),
        fetch(`/api/treasury/${townId}`),
        fetch("/api/loans/me"),
      ]);
      if (pRes.ok) setPortfolio(await pRes.json());
      if (sRes.ok) setStocks(await sRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setWallet(me.wallet);
      }
      if (treasuryRes.ok) setTreasurySummary(await treasuryRes.json());
      if (loanRes.ok) {
        const loanData = await loanRes.json();
        setLoanState(loanData.loan ?? null);
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
    if (!open || !intent) return;

    setActiveTab(intent.tab);

    if (intent.tab === "treasury") {
      onIntentConsumed?.();
      return;
    }

    const normalizedSymbol = intent.symbol?.trim().toUpperCase();
    if (!normalizedSymbol) {
      setSelectedStock(null);
      onIntentConsumed?.();
      return;
    }

    if (stocks.length === 0) return;

    const match = stocks.find((stock) => stock.symbol.toUpperCase() === normalizedSymbol);
    if (match) {
      setSelectedStock(match);
    } else {
      setSelectedStock(null);
      toast.warning(`${normalizedSymbol} is no longer listed.`);
    }
    onIntentConsumed?.();
  }, [open, intent, stocks, onIntentConsumed]);

  const buy = (symbol: string, quantity: number) => socket?.emit("buy_stock", { symbol, quantity });
  const sell = (symbol: string, quantity: number) => socket?.emit("sell_stock", { symbol, quantity });

  const refreshFinance = async () => {
    const townId = townData?.id ?? 1;
    const [meRes, treasuryRes, loanRes] = await Promise.all([
      fetch("/api/me"),
      fetch(`/api/treasury/${townId}`),
      fetch("/api/loans/me"),
    ]);
    if (meRes.ok) {
      const me = await meRes.json();
      setWallet(me.wallet);
    }
    if (treasuryRes.ok) setTreasurySummary(await treasuryRes.json());
    if (loanRes.ok) {
      const data = await loanRes.json();
      setLoanState(data.loan ?? null);
    }
  };

  const handleIssueLoan = async () => {
    try {
      setLoanBusy(true);
      const quoteRes = await fetch("/api/loans/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPrincipal: loanPrincipalInput }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteData?.eligible || !quoteData?.quote) {
        toast.error(quoteData?.reasonCode ?? "Not eligible for loan");
        return;
      }
      const issueRes = await fetch("/api/loans/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: quoteData.quote,
          quoteHash: quoteData.quote.hash,
          idempotencyKey: `issue:${Date.now()}:${Math.random()}`,
        }),
      });
      const issueData = await issueRes.json();
      if (issueData?.error) {
        toast.error(issueData.error);
        return;
      }
      toast.success("Loan issued");
      await refreshFinance();
    } finally {
      setLoanBusy(false);
    }
  };

  const handleRepayLoan = async () => {
    if (!loanState) return;
    try {
      setLoanBusy(true);
      const repayRes = await fetch("/api/loans/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loanState.id,
          amount: repayAmountInput,
          idempotencyKey: `repay:${Date.now()}:${Math.random()}`,
        }),
      });
      const repayData = await repayRes.json();
      if (repayData?.error) {
        toast.error(repayData.error);
        return;
      }
      toast.success("Repayment submitted");
      await refreshFinance();
    } finally {
      setLoanBusy(false);
    }
  };

  const currentHolding = useMemo(() => {
    if (!selectedStock) return 0;
    return portfolio.find((p) => p.stockId === selectedStock.id)?.quantity || 0;
  }, [portfolio, selectedStock]);

  const lineStroke = (selectedStock?.price ?? 0) >= (selectedStock?.previousPrice ?? 0) ? CHART_STROKE_UP : CHART_STROKE_DOWN;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[880px] h-[720px] cyber-panel text-white p-0 overflow-hidden overflow-x-clip flex flex-col border-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-scanline" />
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CentralManagementTab)} className="w-full h-full flex flex-col overflow-x-clip">
          <DialogHeader className="p-6 pb-0 flex flex-row justify-between items-center relative z-10">
            <DialogTitle className="text-2xl font-heading font-black italic tracking-tighter text-white cyber-glitch-text" data-text="BB_CENTRAL_COMMAND">
              BB_CENTRAL_COMMAND
            </DialogTitle>
            <TabsList className="bg-black/40 border border-white/10 p-1 cyber-skew">
              <TabsTrigger value="treasury" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Treasury</TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Market</TabsTrigger>
              <TabsTrigger value="news" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">News</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-clip p-6">
            <TabsContent value="treasury" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 cyber-border bg-black/40 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-brand-primary/20 flex items-center justify-center border border-brand-primary/30"><Wallet className="w-8 h-8 text-brand-secondary" /></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">City Treasury</h3>
                  <div className="text-5xl font-black italic tracking-tighter text-white">${(treasurySummary?.bankBalance ?? townData?.bankBalance ?? 0).toLocaleString()}</div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Today variation: {(treasurySummary?.todaySnapshot?.variationAmount ?? 0) >= 0 ? "+" : ""}{treasurySummary?.todaySnapshot?.variationAmount ?? 0}</div>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">Borrow Node</div>
                  {!loanState ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <input value={loanPrincipalInput} onChange={(e) => setLoanPrincipalInput(Number(e.target.value) || 0)} type="number" min={500} className="w-full bg-black/40 border-2 border-white/10 px-4 py-2 text-white font-mono focus:border-brand-primary focus:outline-none" />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 font-mono">CREDITS</div>
                      </div>
                      <button onClick={handleIssueLoan} disabled={loanBusy} className="group relative w-full">
                         <div className="absolute inset-0 bg-brand-secondary/20 blur group-hover:bg-brand-secondary/40 transition-all" />
                         <div className="cyber-skew bg-brand-secondary px-4 py-3 relative transition-transform group-active:scale-95 text-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Initiate_Credit_Line</span>
                         </div>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">STATUS:</span> <span className="font-bold text-brand-secondary">{loanState.status}</span></div>
                      <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">PRINCIPAL:</span> <span className="font-bold text-white">${loanState.remainingPrincipal.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">FEES:</span> <span className="font-bold text-brand-tertiary">${loanState.lateFeesAccrued.toLocaleString()}</span></div>
                      <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-gray-500">DUE_DATE:</span> <span className="font-bold text-white">{loanState.nextDueDateKey}</span></div>
                      <div className="pt-2">
                        <input value={repayAmountInput} onChange={(e) => setRepayAmountInput(Number(e.target.value) || 0)} type="number" min={100} className="w-full bg-black/40 border border-white/10 px-3 py-2 text-white mb-2" />
                        <button onClick={handleRepayLoan} disabled={loanBusy} className="group relative w-full">
                           <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                           <div className="cyber-skew bg-brand-primary px-4 py-3 relative transition-transform group-active:scale-95 text-center">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Execute Repayment</span>
                           </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-black/40 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 text-[8px] text-brand-primary font-mono opacity-50">HISTORICAL DATA</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Treasury Ledger v1.0</div>
                <div className="space-y-1 text-sm text-gray-300">
                  {(treasurySummary?.last7Days ?? []).map((day) => (
                    <div key={day.dateKey} className="flex justify-between">
                      <span>{day.dateKey}</span>
                      <span className={day.variationAmount >= 0 ? "text-brand-secondary" : "text-brand-tertiary"}>{day.variationAmount >= 0 ? "+" : ""}{day.variationAmount}</span>
                    </div>
                  ))}
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
                        <button key={stock.id} onClick={() => setSelectedStock(stock)} className="flex justify-between items-center p-4 bg-black/40 border border-white/10 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group text-left relative overflow-hidden">
                          <div className={`absolute left-0 top-0 w-1 h-full ${isUp ? "bg-brand-secondary" : "bg-brand-tertiary"}`} />
                          <div className="flex items-center gap-4">
                            <div className={`p-2 ${isUp ? "text-brand-secondary" : "text-brand-tertiary"}`}>{isUp ? <ArrowUpCircle /> : <ArrowDownCircle />}</div>
                            <div>
                              <div className="font-black text-xl italic tracking-tighter group-hover:text-brand-primary transition-colors flex items-center gap-2">{stock.symbol}{owned > 0 && <span className="text-[8px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 border border-brand-primary/30 font-black uppercase tracking-widest">{owned}_NODES</span>}</div>
                              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{stock.name} • {(stock.sector ?? "Sector_N/A")}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-2xl font-black text-white tracking-tighter">${stock.price.toFixed(2)}</div>
                            <div className={`text-[10px] font-black tracking-widest ${isUp ? "text-brand-secondary" : "text-brand-tertiary"}`}>{isUp ? "INDEX_UP" : "INDEX_DOWN"} {Math.abs(diff).toFixed(2)}</div>
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
                    <button onClick={() => buy(selectedStock.symbol, 1)} className="group relative w-full">
                       <div className="absolute inset-0 bg-brand-secondary/20 blur group-hover:bg-brand-secondary/40 transition-all" />
                       <div className="cyber-skew bg-brand-secondary px-4 py-4 relative transition-transform group-active:scale-95 text-center">
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-black">Execute_Buy_Order</span>
                       </div>
                    </button>
                    <button onClick={() => sell(selectedStock.symbol, 1)} disabled={currentHolding === 0} className="group relative w-full disabled:opacity-30">
                       <div className="absolute inset-0 bg-brand-tertiary/20 blur group-hover:bg-brand-tertiary/40 transition-all" />
                       <div className="cyber-skew bg-brand-tertiary px-4 py-4 relative transition-transform group-active:scale-95 text-center">
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Execute_Sell_Order</span>
                       </div>
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="news" className="mt-0 h-full">
              <NewsFeedSurface mode="modal" townId={townId} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
