"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Package, HelpCircle, Layers, CreditCard, Trash2, Scissors } from "lucide-react";

interface InventorySlot {
  slotIndex: number;
  item: {
    key: string;
    displayName: string;
    category: string;
    baseValue: number;
    maxStackSize: number;
  } | null;
  quantity: number;
  documentId: string | null;
}

interface InventoryGridProps {
  slots: InventorySlot[];
  capacity: number;
  wallet: number;
  level: number;
  onRefresh: () => void;
}

export function InventoryGrid({ slots, capacity, wallet, level, onRefresh }: InventoryGridProps) {
  const [selectedSlot, setSelectedSlot] = useState<InventorySlot | null>(null);
  const [splitActive, setSplitActive] = useState(false);
  const [splitQty, setSplitQty] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Find first available empty slot index to split stack into
  const emptySlots = slots.filter((s) => s.item === null);
  const firstEmptySlot = emptySlots.length > 0 ? emptySlots[0].slotIndex : null;

  const handleSelectSlot = (slot: InventorySlot) => {
    if (!slot.item) return;
    setSelectedSlot(slot);
    setSplitActive(false);
    setSplitQty(1);
  };

  const handleSplitStack = async () => {
    if (!selectedSlot || !selectedSlot.item || firstEmptySlot === null) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSlot: selectedSlot.slotIndex,
          toSlot: firstEmptySlot,
          splitQuantity: splitQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to split stack");

      toast.success(`Successfully split ${splitQty}x ${selectedSlot.item.displayName}`);
      setSelectedSlot(null);
      setSplitActive(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Could not split stack");
    } finally {
      setLoading(false);
    }
  };

  const getItemColorClass = (category: string) => {
    switch (category) {
      case "CONSUMABLE":
        return "border-brand-secondary/40 text-brand-secondary bg-brand-secondary/5 shadow-[inset_0_0_12px_rgba(255,184,0,0.05)]";
      case "MATERIAL":
        return "border-brand-primary/40 text-brand-primary bg-brand-primary/5 shadow-[inset_0_0_12px_rgba(189,0,255,0.05)]";
      default:
        return "border-white/10 text-gray-400 bg-white/5";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-1 text-white">
      {/* Grid Bag Slots (Left) */}
      <div className="md:col-span-8 space-y-4">
        <div className="flex justify-between items-center bg-black/30 p-4 border border-white/5 rounded-none">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-secondary font-mono">
              🎒 SECURE STORAGE MODULE
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              Slot Occupancy: {slots.filter(s => s.item).length} / {capacity} [Lvl {level} Capacity]
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Personal Wallet</div>
            <div className="text-md font-black text-brand-primary font-mono">${wallet.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5 p-4 bg-black/50 border border-white/5 rounded-none min-h-[220px]">
          {slots.map((slot) => {
            const hasItem = slot.item !== null;
            const isSelected = selectedSlot?.slotIndex === slot.slotIndex;
            return (
              <button
                key={slot.slotIndex}
                onClick={() => handleSelectSlot(slot)}
                disabled={!hasItem && !isSelected}
                className={`relative aspect-square border flex flex-col items-center justify-center transition-all duration-200 group p-1 ${
                  hasItem
                    ? getItemColorClass(slot.item.category) +
                      " hover:border-brand-primary hover:scale-[1.03] cursor-pointer"
                    : "border-white/5 bg-black/30 text-gray-600 cursor-default"
                } ${isSelected ? "border-brand-primary ring-2 ring-brand-primary/30 scale-[1.03]" : ""}`}
              >
                {/* Slot index debug */}
                <span className="absolute top-1 left-1.5 text-[8px] font-mono text-gray-600 group-hover:text-gray-400 select-none">
                  {slot.slotIndex + 1}
                </span>

                {hasItem ? (
                  <div className="flex flex-col items-center justify-center w-full h-full relative">
                    <Package className="w-6 h-6 stroke-[1.5]" />
                    <span className="text-[9px] uppercase font-bold tracking-tighter text-center truncate max-w-full mt-1.5 text-white/90">
                      {slot.item.displayName}
                    </span>
                    {/* Stack count */}
                    <span className="absolute bottom-1 right-1.5 font-mono text-[10px] font-black text-white bg-black/80 px-1 border border-white/10 select-none">
                      {slot.quantity}
                    </span>
                  </div>
                ) : (
                  <div className="w-4 h-4 border border-dashed border-white/5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Item Panel / Stack Splitting (Right) */}
      <div className="md:col-span-4">
        {selectedSlot && selectedSlot.item ? (
          <div className="bg-black/40 border border-brand-primary/20 p-5 space-y-5 rounded-none shadow-[0_0_30px_rgba(189,0,255,0.03)] h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[8px] font-black tracking-widest text-brand-primary border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 uppercase">
                    {selectedSlot.item.category}
                  </span>
                  <h3 className="text-xl font-heading font-black italic tracking-tighter mt-2 text-white">
                    {selectedSlot.item.displayName}
                  </h3>
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-1">
                    Slot Index: {selectedSlot.slotIndex + 1}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="text-xs text-gray-500 hover:text-white uppercase font-bold tracking-wider"
                >
                  [Esc]
                </button>
              </div>

              <div className="h-px bg-white/5" />

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-white/5 p-3 border border-white/5 text-center">
                  <div className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mb-1">Stack Limit</div>
                  <div className="text-sm font-bold text-white">{selectedSlot.item.maxStackSize} units</div>
                </div>
                <div className="bg-white/5 p-3 border border-white/5 text-center">
                  <div className="text-[8px] uppercase tracking-wider text-gray-400 font-bold mb-1">Base Price</div>
                  <div className="text-sm font-bold text-brand-secondary">${selectedSlot.item.baseValue}</div>
                </div>
              </div>

              {!splitActive ? (
                <div className="space-y-2 pt-2">
                  {selectedSlot.quantity > 1 ? (
                    <button
                      onClick={() => {
                        if (firstEmptySlot === null) {
                          toast.error("Bag is full! Free up a slot to split this stack.");
                        } else {
                          setSplitActive(true);
                          setSplitQty(1);
                        }
                      }}
                      className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-brand-primary/30"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Split Stack Bundle
                    </button>
                  ) : (
                    <div className="text-center text-[10px] uppercase tracking-wider font-mono text-gray-500 py-3 border border-dashed border-white/10">
                      Cannot split single item stack
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 bg-white/5 p-4 border border-white/5 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase tracking-widest font-mono text-brand-primary font-bold">
                      Split Size Selection
                    </span>
                    <button
                      onClick={() => setSplitActive(false)}
                      className="text-[9px] uppercase tracking-widest font-bold text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={selectedSlot.quantity - 1}
                      value={splitQty}
                      onChange={(e) => setSplitQty(Number(e.target.value))}
                      className="w-full h-1 bg-black accent-brand-primary cursor-pointer"
                    />
                    <span className="text-sm font-mono font-bold w-12 text-center bg-black/50 border border-white/10 py-1 px-2">
                      {splitQty}
                    </span>
                  </div>

                  <div className="text-[9px] font-mono text-gray-400 text-center uppercase tracking-widest">
                    Splitting stack of {selectedSlot.quantity} ➔ [{selectedSlot.quantity - splitQty}] and [{splitQty}]
                  </div>

                  <button
                    onClick={handleSplitStack}
                    disabled={loading}
                    className="w-full bg-brand-secondary hover:bg-brand-secondary/80 text-black py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  >
                    Confirm Split Stack
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4">
              <div className="bg-black/30 border border-white/5 p-3 text-[10px] font-mono text-gray-400 space-y-1">
                <span className="text-white font-bold block mb-1">🎒 SECURE DEPLOYMENT:</span>
                Items in storage contribute automatically to daily building consumption sweeps in the town! Keep them stacked and locked here.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-black/30 border border-white/5 p-8 rounded-none h-full flex flex-col items-center justify-center text-center text-gray-500">
            <Package className="w-10 h-10 stroke-[1] text-gray-600 mb-3" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 font-heading">
              NO ITEM SELECTED
            </div>
            <div className="text-[10px] font-mono max-w-[200px] mt-2">
              Select an active inventory slot grid node to view metrics, split bundles, or manage quantities.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
