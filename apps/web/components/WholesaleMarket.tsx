"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, ArrowRightCircle, Coins, Plus, Minus } from "lucide-react";

interface WholesaleItem {
  key: string;
  displayName: string;
  category: "CONSUMABLE" | "EQUIPMENT" | "MATERIAL" | "OTHER";
  baseValue: number;
  maxStackSize: number;
  description: string;
}

const WHOLESALE_ITEMS: WholesaleItem[] = [
  { key: "furniture", displayName: "Furniture", category: "MATERIAL", baseValue: 500, maxStackSize: 10, description: "Home decor and high-grade hosting setups." },
  { key: "alcohol", displayName: "Alcohol", category: "CONSUMABLE", baseValue: 50, maxStackSize: 99, description: "Essential libations for wild and memorable parties." },
  { key: "condoms", displayName: "Condoms", category: "CONSUMABLE", baseValue: 10, maxStackSize: 99, description: "Protective equipment for late-night safety." },
  { key: "lube", displayName: "Lube", category: "CONSUMABLE", baseValue: 15, maxStackSize: 99, description: "Slick and smooth fluid to reduce friction." },
  { key: "disinfectant", displayName: "Disinfectant", category: "CONSUMABLE", baseValue: 20, maxStackSize: 99, description: "Sanitizing spray for post-party hygiene sweeps." },
  { key: "soap", displayName: "Soap", category: "CONSUMABLE", baseValue: 5, maxStackSize: 99, description: "Classic cleansing bar for standard sanitation." },
  { key: "candles", displayName: "Candles", category: "CONSUMABLE", baseValue: 8, maxStackSize: 99, description: "Aromatic wax to set the perfect neon-lit mood." },
  { key: "lingerie", displayName: "Lingerie", category: "MATERIAL", baseValue: 150, maxStackSize: 20, description: "Premium reizwäsche and erotic party wear." },
  { key: "perfumes", displayName: "Perfumes", category: "CONSUMABLE", baseValue: 120, maxStackSize: 50, description: "Seductive fragrances and high-appeal sprays." },
];

interface WholesaleMarketProps {
  wallet: number;
  onPurchaseComplete: () => void;
}

export function WholesaleMarket({ wallet, onPurchaseComplete }: WholesaleMarketProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    WHOLESALE_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: 1 }), {})
  );
  const [buyingItem, setBuyingItem] = useState<string | null>(null);

  const handleAdjustQuantity = (key: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[key] ?? 1;
      const next = Math.max(1, Math.min(99, current + delta));
      return { ...prev, [key]: next };
    });
  };

  const handleManualQuantity = (key: string, val: string) => {
    const num = Number(val.replace(/[^0-9]/g, ""));
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(1, Math.min(99, num)),
    }));
  };

  const handleBuyItem = async (item: WholesaleItem) => {
    const qty = quantities[item.key] ?? 1;
    const cost = item.baseValue * qty;

    if (wallet < cost) {
      toast.error(`Not enough credits to purchase ${qty}x ${item.displayName}!`);
      return;
    }

    setBuyingItem(item.key);
    try {
      const res = await fetch("/api/inventory/wholesale/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemKey: item.key,
          quantity: qty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");

      toast.success(`Successfully imported ${qty}x ${item.displayName} for $${cost.toLocaleString()} Credits!`);
      // Reset count to 1
      setQuantities((prev) => ({ ...prev, [item.key]: 1 }));
      onPurchaseComplete();
    } catch (err: any) {
      toast.error(err.message || "Purchase failed");
    } finally {
      setBuyingItem(null);
    }
  };

  return (
    <div className="space-y-6 text-white p-1">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-black/30 p-4 border border-white/5 rounded-none">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-secondary font-mono">
            🚢 WHOLESALE IMPORT TERMINAL
          </div>
          <div className="text-xs text-gray-400 font-mono mt-0.5">
            Procure essential commodities directly from the international BBTown harbor.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Liquid Credit Reserves</div>
          <div className="text-md font-black text-brand-primary font-mono">${wallet.toLocaleString()}</div>
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WHOLESALE_ITEMS.map((item) => {
          const qty = quantities[item.key] ?? 1;
          const cost = item.baseValue * qty;
          const isLackingFunds = wallet < cost;
          const isBuying = buyingItem === item.key;

          return (
            <div
              key={item.key}
              className="bg-black/40 border border-white/10 p-5 rounded-none flex flex-col justify-between hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-all group shadow-[0_0_15px_rgba(0,0,0,0.2)]"
            >
              <div className="space-y-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] font-mono tracking-widest text-brand-secondary border border-brand-secondary/30 bg-brand-secondary/5 px-2 py-0.5 uppercase">
                      {item.category}
                    </span>
                    <h4 className="text-lg font-black italic tracking-tighter mt-2 text-white group-hover:text-brand-primary transition-colors">
                      {item.displayName}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-gray-500 font-mono block">Wholesale Value</span>
                    <span className="text-sm font-black text-brand-primary font-mono">${item.baseValue}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-mono leading-relaxed h-[36px] overflow-hidden">
                  {item.description}
                </p>

                <div className="h-px bg-white/5" />
              </div>

              <div className="space-y-4 pt-4">
                {/* Quantity adjustments */}
                <div className="flex justify-between items-center bg-black/40 border border-white/5 p-2 rounded-none">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-mono font-bold pl-2">
                    Import Size
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdjustQuantity(item.key, -5)}
                      className="w-6 h-6 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center font-bold text-[10px] font-mono border border-white/10 transition-colors"
                      disabled={qty <= 1}
                    >
                      -5
                    </button>
                    <button
                      onClick={() => handleAdjustQuantity(item.key, -1)}
                      className="w-6 h-6 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
                      disabled={qty <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      value={qty}
                      onChange={(e) => handleManualQuantity(item.key, e.target.value)}
                      className="w-10 h-6 bg-black border border-white/10 text-center font-mono text-xs font-bold text-white focus:border-brand-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handleAdjustQuantity(item.key, 1)}
                      className="w-6 h-6 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
                      disabled={qty >= 99}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleAdjustQuantity(item.key, 5)}
                      className="w-6 h-6 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center font-bold text-[10px] font-mono border border-white/10 transition-colors"
                      disabled={qty >= 99}
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Confirm buy button */}
                <button
                  onClick={() => handleBuyItem(item)}
                  disabled={isBuying || isLackingFunds}
                  className={`w-full py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                    isLackingFunds
                      ? "bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed"
                      : "bg-brand-primary hover:bg-brand-primary/80 border-brand-primary/30 text-white cursor-pointer"
                  }`}
                >
                  {isBuying ? (
                    "IMPORTING CARGO..."
                  ) : isLackingFunds ? (
                    `LACKING FUNDS ($${cost.toLocaleString()})`
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Buy Import for ${cost.toLocaleString()}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
