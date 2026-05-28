"use client";

import React, { useState, useEffect } from "react";
import { Coins, Package, User, Plus, Minus, ArrowLeftRight, Check, X, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { InventorySlot } from "@/lib/bff/inventoryService";

interface TradeItem {
  key: string;
  quantity: number;
}

interface PlayerProfileShort {
  username: string;
  documentId: string;
}

interface TradeProposal {
  documentId: string;
  id: string | number;
  proposerName: string;
  receiverName: string;
  offeredCredits: number;
  requestedCredits: number;
  offeredItems: TradeItem[];
  requestedItems: TradeItem[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

interface P2PTradePanelProps {
  slots: InventorySlot[];
  capacity: number;
  wallet: number;
  onRefresh: () => void;
}

const ITEMS_LIST = [
  { key: "alcohol", displayName: "Alcohol", icon: "🍺" },
  { key: "condoms", displayName: "Condoms", icon: "🎈" },
  { key: "soap", displayName: "Soap", icon: "🧼" },
  { key: "candles", displayName: "Candles", icon: "🕯️" },
  { key: "lube", displayName: "Lube", icon: "🧴" },
  { key: "perfumes", displayName: "Perfumes", icon: "🧪" },
  { key: "furniture", displayName: "Furniture", icon: "🛋️" },
  { key: "disinfectant", displayName: "Disinfectant", icon: "🧽" },
  { key: "lingerie", displayName: "Lingerie", icon: "👙" },
];

export function P2PTradePanel({ slots, capacity, wallet, onRefresh }: P2PTradePanelProps) {
  // Navigation tabs inside trade panel
  const [subTab, setSubTab] = useState<"propose" | "incoming" | "outgoing">("propose");

  // Propose Trade form states
  const [players, setPlayers] = useState<PlayerProfileShort[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [offeredCredits, setOfferedCredits] = useState<number>(0);
  const [requestedCredits, setRequestedCredits] = useState<number>(0);
  const [offeredItems, setOfferedItems] = useState<Record<string, number>>({});
  const [requestedItems, setRequestedItems] = useState<Record<string, number>>({});

  // Active proposals list
  const [incomingProposals, setIncomingProposals] = useState<TradeProposal[]>([]);
  const [outgoingProposals, setOutgoingProposals] = useState<TradeProposal[]>([]);

  // Loading states
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [resolvingProposalId, setResolvingProposalId] = useState<string | null>(null);

  // Group current user's available inventory quantities
  const availableInventory = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of slots) {
      if (slot.item) {
        counts[slot.item.key] = (counts[slot.item.key] || 0) + slot.quantity;
      }
    }
    return counts;
  }, [slots]);

  // Fetch players and proposals on mount
  useEffect(() => {
    fetchPlayers();
    fetchProposals();
  }, []);

  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const res = await fetch("/api/trade/players");
      if (res.ok) {
        const list = await res.json();
        setPlayers(list);
      }
    } catch (err) {
      console.error("Failed to load players for trade selector", err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const fetchProposals = async () => {
    setLoadingProposals(true);
    try {
      const res = await fetch("/api/trade/list");
      if (res.ok) {
        const data = await res.json();
        setIncomingProposals(data.incoming ?? []);
        setOutgoingProposals(data.outgoing ?? []);
      }
    } catch (err) {
      console.error("Failed to load trade proposals", err);
    } finally {
      setLoadingProposals(false);
    }
  };

  // Propose trade actions
  const adjustOfferedItem = (key: string, amount: number) => {
    const current = offeredItems[key] || 0;
    const available = availableInventory[key] || 0;
    const next = Math.max(0, Math.min(available, current + amount));
    
    setOfferedItems(prev => ({
      ...prev,
      [key]: next,
    }));
  };

  const adjustRequestedItem = (key: string, amount: number) => {
    const current = requestedItems[key] || 0;
    const next = Math.max(0, current + amount);
    
    setRequestedItems(prev => ({
      ...prev,
      [key]: next,
    }));
  };

  const submitTradeProposal = async () => {
    if (!selectedPlayer) {
      toast.error("Please select a recipient bunny player.");
      return;
    }
    if (offeredCredits > wallet) {
      toast.error("You cannot offer more credits than you own.");
      return;
    }

    // Format offeredItems and requestedItems arrays
    const formattedOffered = Object.entries(offeredItems)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => ({ key, quantity: qty }));

    const formattedRequested = Object.entries(requestedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => ({ key, quantity: qty }));

    if (offeredCredits === 0 && requestedCredits === 0 && formattedOffered.length === 0 && formattedRequested.length === 0) {
      toast.error("Your proposal cannot be completely empty.");
      return;
    }

    setSubmittingProposal(true);
    try {
      const res = await fetch("/api/trade/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverUsername: selectedPlayer,
          offeredCredits,
          requestedCredits,
          offeredItems: formattedOffered,
          requestedItems: formattedRequested,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Trade proposal failed.");
      } else {
        toast.success(`Trade proposed successfully to ${selectedPlayer}! Credits and offered items are locked in escrow.`);
        // Reset form
        setOfferedCredits(0);
        setRequestedCredits(0);
        setOfferedItems({});
        setRequestedItems({});
        setSelectedPlayer("");
        // Refresh
        onRefresh();
        fetchProposals();
      }
    } catch (err) {
      toast.error("Failed to propose trade.");
    } finally {
      setSubmittingProposal(false);
    }
  };

  // Resolve trade actions
  const handleResolve = async (proposalId: string, action: "ACCEPT" | "REJECT" | "CANCEL") => {
    setResolvingProposalId(proposalId);
    try {
      const res = await fetch(`/api/trade/${proposalId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Failed to ${action.toLowerCase()} trade.`);
      } else {
        toast.success(`Trade proposal ${action.toLowerCase()}ed successfully!`);
        onRefresh();
        fetchProposals();
      }
    } catch (err) {
      toast.error(`Error resolving trade proposal: ${action}`);
    } finally {
      setResolvingProposalId(null);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-black/60 border border-white/10 rounded-sm overflow-hidden text-gray-200">
      {/* Sub-Tabs Selector */}
      <div className="flex border-b border-white/10 bg-white/5">
        <button
          onClick={() => setSubTab("propose")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${
            subTab === "propose"
              ? "bg-brand-primary/10 text-brand-primary border-b-2 border-brand-primary"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Propose Trade
        </button>
        <button
          onClick={() => setSubTab("incoming")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest relative transition-all ${
            subTab === "incoming"
              ? "bg-brand-secondary/10 text-brand-secondary border-b-2 border-brand-secondary"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Incoming Proposals
          {incomingProposals.filter(p => p.status === "PENDING").length > 0 && (
            <span className="absolute top-2 right-4 h-2 w-2 rounded-full bg-brand-secondary animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setSubTab("outgoing")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${
            subTab === "outgoing"
              ? "bg-brand-tertiary/10 text-brand-tertiary border-b-2 border-brand-tertiary"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Outgoing Escrows
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {subTab === "propose" && (
          <div className="space-y-6">
            {/* Player Selection & Credits Input Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Bunny Selector */}
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-black uppercase text-brand-primary tracking-widest flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Select Bunny Partner
                </label>
                {loadingPlayers ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-primary" /> Scanning network...
                  </div>
                ) : (
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full bg-black border border-white/20 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-brand-primary"
                  >
                    <option value="">-- Choose Bun --</option>
                    {players.map((p) => (
                      <option key={p.documentId} value={p.username}>
                        {p.username}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* General Swap Summary Info */}
              <div className="flex items-center gap-4 bg-brand-primary/5 border border-brand-primary/20 rounded-sm p-3 text-[11px] leading-relaxed text-gray-300">
                <ShieldAlert className="h-5 w-5 text-brand-primary shrink-0" />
                <div>
                  <span className="font-bold text-white uppercase tracking-wider block mb-0.5">Secure Escrow Shield Active</span>
                  Offered resources will be securely locked in system containers until accepted or returned.
                </div>
              </div>
            </div>

            {/* Swap Builder Split Pane */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Offered / Left Column */}
              <div className="space-y-4 border-r border-white/5 pr-0 md:pr-4">
                <div className="flex items-center justify-between border-b border-brand-secondary/30 pb-2">
                  <span className="text-[10px] font-black uppercase text-brand-secondary tracking-widest flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" /> Your Escrowed Offer
                  </span>
                  <span className="text-[10px] text-gray-400">Available: ${wallet} credits</span>
                </div>

                {/* Credits offer input */}
                <div className="flex items-center justify-between bg-black/40 border border-white/10 p-2.5 rounded-sm">
                  <span className="text-xs text-gray-300">Offered Credits</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      value={offeredCredits}
                      onChange={(e) => setOfferedCredits(Math.max(0, Math.min(wallet, Number(e.target.value))))}
                      className="w-20 bg-black text-right border border-white/20 rounded-sm px-2 py-0.5 text-xs text-brand-secondary focus:outline-none focus:border-brand-secondary"
                    />
                  </div>
                </div>

                {/* Grid of offered items */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Offered Cargo Commodities:</span>
                  <div className="grid grid-cols-1 gap-2">
                    {ITEMS_LIST.map((item) => {
                      const countInStock = availableInventory[item.key] || 0;
                      const selectedCount = offeredItems[item.key] || 0;

                      return (
                        <div key={item.key} className="flex items-center justify-between bg-black/30 border border-white/5 p-2 rounded-sm text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <div>
                              <span className="font-bold block">{item.displayName}</span>
                              <span className="text-[9px] text-gray-400">In Stock: {countInStock}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustOfferedItem(item.key, -1)}
                              disabled={selectedCount <= 0}
                              className="h-6 w-6 bg-white/5 border border-white/10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className={`w-8 text-center font-black ${selectedCount > 0 ? "text-brand-secondary" : "text-gray-500"}`}>
                              {selectedCount}
                            </span>
                            <button
                              onClick={() => adjustOfferedItem(item.key, 1)}
                              disabled={selectedCount >= countInStock}
                              className="h-6 w-6 bg-white/5 border border-white/10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Requested / Right Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-brand-tertiary/30 pb-2">
                  <span className="text-[10px] font-black uppercase text-brand-tertiary tracking-widest flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Your Requested Assets
                  </span>
                </div>

                {/* Credits request input */}
                <div className="flex items-center justify-between bg-black/40 border border-white/10 p-2.5 rounded-sm">
                  <span className="text-xs text-gray-300">Requested Credits</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      value={requestedCredits}
                      onChange={(e) => setRequestedCredits(Math.max(0, Number(e.target.value)))}
                      className="w-20 bg-black text-right border border-white/20 rounded-sm px-2 py-0.5 text-xs text-brand-tertiary focus:outline-none focus:border-brand-tertiary"
                    />
                  </div>
                </div>

                {/* Grid of requested items */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Requested Cargo Commodities:</span>
                  <div className="grid grid-cols-1 gap-2">
                    {ITEMS_LIST.map((item) => {
                      const selectedCount = requestedItems[item.key] || 0;

                      return (
                        <div key={item.key} className="flex items-center justify-between bg-black/30 border border-white/5 p-2 rounded-sm text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className="font-bold">{item.displayName}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustRequestedItem(item.key, -1)}
                              disabled={selectedCount <= 0}
                              className="h-6 w-6 bg-white/5 border border-white/10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className={`w-8 text-center font-black ${selectedCount > 0 ? "text-brand-tertiary" : "text-gray-500"}`}>
                              {selectedCount}
                            </span>
                            <button
                              onClick={() => adjustRequestedItem(item.key, 1)}
                              className="h-6 w-6 bg-white/5 border border-white/10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Execute Proposal Button */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={submitTradeProposal}
                disabled={submittingProposal || !selectedPlayer}
                className="group relative w-full disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all rounded-sm" />
                <div className="bg-brand-primary px-4 py-3 relative.5 transition-transform group-active:scale-[0.98] text-center flex items-center justify-center gap-2 rounded-sm text-black">
                  {submittingProposal ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Escrowing Deal Items...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-4 w-4 text-black" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Submit Trade Proposal</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}

        {(subTab === "incoming" || subTab === "outgoing") && (
          <div className="space-y-4">
            {loadingProposals ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-brand-primary" /> Synchronizing trade containers...
              </div>
            ) : (
              (() => {
                const proposals = subTab === "incoming" ? incomingProposals : outgoingProposals;
                
                if (proposals.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs border border-dashed border-white/10 rounded-sm">
                      <ArrowLeftRight className="h-8 w-8 text-white/20 mb-2" />
                      No active trade proposals found in this log.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {proposals.map((prop) => {
                      const formattedDate = new Date(prop.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      const isPending = prop.status === "PENDING";
                      const proposerColor = "text-brand-secondary";
                      const receiverColor = "text-brand-tertiary";

                      return (
                        <div key={prop.documentId} className="bg-black/40 border border-white/10 rounded-sm p-4 text-xs space-y-3 relative overflow-hidden">
                          {/* Background Glow */}
                          <div className={`absolute top-0 right-0 h-1 w-24 ${
                            prop.status === "ACCEPTED" ? "bg-green-500" :
                            prop.status === "REJECTED" ? "bg-red-500" :
                            prop.status === "CANCELLED" ? "bg-gray-500" :
                            "bg-brand-primary animate-pulse"
                          }`} />

                          {/* Header Details */}
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div>
                              <span className="font-bold text-gray-300">
                                {subTab === "incoming" ? `From: ${prop.proposerName}` : `To: ${prop.receiverName}`}
                              </span>
                              <span className="text-[10px] text-gray-500 block">{formattedDate}</span>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded-[2px] font-black text-[9px] uppercase tracking-wider ${
                              prop.status === "ACCEPTED" ? "bg-green-500/20 text-green-400" :
                              prop.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                              prop.status === "CANCELLED" ? "bg-gray-500/20 text-gray-400" :
                              "bg-brand-primary/20 text-brand-primary"
                            }`}>
                              {prop.status}
                            </span>
                          </div>

                          {/* Proposal Details Grid */}
                          <div className="grid grid-cols-2 gap-4 text-[11px] bg-black/20 p-2 rounded-sm">
                            {/* Proposer Offers */}
                            <div className="space-y-1">
                              <span className={`text-[9px] font-black uppercase tracking-wider ${proposerColor}`}>Offered:</span>
                              <div className="font-black text-white">$ {prop.offeredCredits}</div>
                              <div className="space-y-0.5 text-gray-400">
                                {prop.offeredItems.map(i => (
                                  <div key={i.key}>{i.quantity}x {i.key}</div>
                                )) || "No Items"}
                                {prop.offeredItems.length === 0 && <div className="italic text-[10px]">No commodities</div>}
                              </div>
                            </div>

                            {/* Receiver Requests */}
                            <div className="space-y-1 border-l border-white/5 pl-4">
                              <span className={`text-[9px] font-black uppercase tracking-wider ${receiverColor}`}>Requested:</span>
                              <div className="font-black text-white">$ {prop.requestedCredits}</div>
                              <div className="space-y-0.5 text-gray-400">
                                {prop.requestedItems.map(i => (
                                  <div key={i.key}>{i.quantity}x {i.key}</div>
                                )) || "No Items"}
                                {prop.requestedItems.length === 0 && <div className="italic text-[10px]">No commodities</div>}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Resolution Controls */}
                          {isPending && (
                            <div className="flex items-center gap-2 pt-2">
                              {subTab === "incoming" ? (
                                <>
                                  <button
                                    onClick={() => handleResolve(prop.documentId, "ACCEPT")}
                                    disabled={resolvingProposalId !== null}
                                    className="flex-1 bg-green-600 hover:bg-green-700 active:scale-95 disabled:opacity-50 text-white font-black py-2 rounded-sm flex items-center justify-center gap-1 transition-all uppercase tracking-widest text-[10px]"
                                  >
                                    {resolvingProposalId === prop.documentId ? (
                                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    Accept Trade
                                  </button>
                                  <button
                                    onClick={() => handleResolve(prop.documentId, "REJECT")}
                                    disabled={resolvingProposalId !== null}
                                    className="flex-1 bg-red-600/20 border border-red-500/30 hover:bg-red-600/40 text-red-400 active:scale-[0.98] disabled:opacity-50 font-black py-2 rounded-sm flex items-center justify-center gap-1 transition-all uppercase tracking-widest text-[10px]"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleResolve(prop.documentId, "CANCEL")}
                                  disabled={resolvingProposalId !== null}
                                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold py-2 rounded-sm flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Cancel Escrow (Refund Assets)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
}
