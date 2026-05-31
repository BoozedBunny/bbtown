"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  MailOpen, 
  Trash2, 
  Terminal, 
  Calendar, 
  ChevronRight, 
  ChevronUp, 
  Inbox,
  ArrowLeftRight,
  Check,
  X,
  Loader2
} from "lucide-react";

export interface MailMessage {
  id: string;
  senderName: string | null;
  senderAvatar: string | null;
  recipientId: string;
  subject: string;
  body: string;
  isRead: boolean;
  type: "SYSTEM" | "TRADE_PROPOSAL";
  createdAt: string;
}

interface TradeItem {
  key: string;
  quantity: number;
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

interface MailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMailChanged?: () => void;
}

export function MailboxModal({ isOpen, onClose, onMailChanged }: MailboxModalProps) {
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Trades tracking for interactive trade proposals
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchInbox = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/mail/inbox");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        console.error("Failed to fetch mailbox inbox", res.status);
      }
    } catch (err) {
      console.error("Error fetching inbox:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await fetch("/api/trade/list");
      if (res.ok) {
        const data = await res.json();
        setProposals([...(data.incoming || []), ...(data.outgoing || [])]);
      }
    } catch (err) {
      console.error("Error fetching proposals in mailbox:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInbox();
      fetchProposals();
      setExpandedId(null);
    }
  }, [isOpen]);

  const handleToggleExpand = async (msg: MailMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
    } else {
      setExpandedId(msg.id);
      
      // If unread, mark as read
      if (!msg.isRead) {
        try {
          const res = await fetch(`/api/mail/${msg.id}`, { method: "PUT" });
          if (res.ok) {
            // Optimistically update read state in UI
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
            if (onMailChanged) onMailChanged();
          }
        } catch (err) {
          console.error("Failed to mark mail as read:", err);
        }
      }
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation(); // Avoid triggering row expansion
    
    try {
      const res = await fetch(`/api/mail/${msgId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Log deleted successfully.");
        // Remove from UI list
        const deletedMsg = messages.find((m) => m.id === msgId);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        if (deletedMsg && !deletedMsg.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        if (onMailChanged) onMailChanged();
      } else {
        toast.error("Failed to delete mail message.");
      }
    } catch (err) {
      console.error("Error deleting mail:", err);
    }
  };

  const handleResolveTrade = async (e: React.MouseEvent, proposalId: string, action: "ACCEPT" | "REJECT") => {
    e.stopPropagation(); // Avoid folding the row
    setResolvingId(proposalId);
    
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
        fetchInbox();
        fetchProposals();
        if (onMailChanged) onMailChanged();
      }
    } catch (err) {
      toast.error(`Error resolving trade proposal: ${action}`);
    } finally {
      setResolvingId(null);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] cyber-panel text-white border-t-4 border-t-brand-primary rounded-none shadow-[0_0_50px_rgba(189,0,255,0.15)] p-0 overflow-y-auto max-h-[90vh]">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <DialogTitle
              className="text-3xl font-heading font-black italic tracking-tighter text-brand-primary cyber-glitch-text"
              data-text="SYSTEM INBOX"
            >
              SYSTEM INBOX
            </DialogTitle>
            <DialogDescription className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em] flex items-center justify-between">
              <span>Mailbox Node // Auth Confirmed</span>
              {unreadCount > 0 && (
                <span className="text-brand-primary animate-pulse text-[8px] font-black">
                  {unreadCount} NEW LOGS
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {isLoading && messages.length === 0 ? (
            <div className="text-center py-12 font-mono text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">
              Syncing inbox directory...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-white/5 bg-black/30 space-y-4">
              <Inbox className="h-12 w-12 text-gray-600 stroke-[1.5]" />
              <div className="text-center space-y-1">
                <p className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black">
                  [ INBOX NODE EMPTY ]
                </p>
                <p className="font-mono text-[8px] text-gray-600 uppercase tracking-wider">
                  No notifications or system logs recorded.
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 max-h-[450px] overflow-y-auto pr-1">
              {messages.map((msg) => {
                const isExpanded = expandedId === msg.id;

                // Check if message is a trade proposal
                const isTrade = msg.type === "TRADE_PROPOSAL";
                let proposalDocId = "";
                if (isTrade) {
                  const firstLine = msg.body.split("\n")[0];
                  if (firstLine && firstLine.startsWith("PROPOSAL_ID:")) {
                    proposalDocId = firstLine.substring("PROPOSAL_ID:".length).trim();
                  }
                }

                // Match with fetched proposals to display correct visual status
                const linkedProposal = isTrade ? proposals.find(p => p.documentId === proposalDocId) : null;

                return (
                  <li
                    key={msg.id}
                    onClick={() => handleToggleExpand(msg)}
                    className={`flex flex-col border transition-all cursor-pointer select-none bg-black/40 ${
                      isExpanded 
                        ? "border-brand-primary bg-brand-primary/5 shadow-[0_0_15px_rgba(189,0,255,0.05)]" 
                        : "border-white/5 hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {/* Status Icon Indicator */}
                        <div className="relative flex-shrink-0">
                          {msg.isRead ? (
                            <MailOpen className="h-4 w-4 text-gray-500" />
                          ) : (
                            <div className="relative">
                              <Mail className="h-4 w-4 text-brand-primary" />
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-cyan-400 rounded-full animate-ping" />
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-cyan-400 rounded-full" />
                            </div>
                          )}
                        </div>

                        {/* Title Subject */}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[11px] uppercase tracking-wide truncate ${!msg.isRead ? "text-white font-black" : "text-gray-300"}`}>
                            {msg.subject}
                          </span>
                          <span className="text-[8px] text-gray-500 font-mono uppercase tracking-widest mt-0.5">
                            From: {msg.senderName}
                          </span>
                        </div>
                      </div>

                      {/* Controls and Expansion toggle */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          onClick={(e) => handleDeleteMessage(e, msg.id)}
                          className="p-1 hover:text-brand-tertiary text-gray-600 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-brand-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Terminal Log Body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 animate-fadeIn">
                        <div className="h-px bg-white/5 w-full" />
                        
                        {isTrade && linkedProposal ? (
                          /* SPECIAL INTERACTIVE DECRYPTED TRADE TERMINAL */
                          <div className="space-y-3 bg-black/60 border border-brand-primary/20 p-4 rounded-sm">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-mono">
                              <span className="text-brand-primary flex items-center gap-1">
                                <ArrowLeftRight className="h-3.5 w-3.5 animate-pulse" /> P2P SWAP DECRYPTED
                              </span>
                              <span className="text-gray-400">ID: {linkedProposal.id}</span>
                            </div>

                            {/* Visual Swap Layout */}
                            <div className="grid grid-cols-2 gap-4 text-[11px] py-1 bg-black/40 border border-white/5 p-3 rounded-sm">
                              {/* Left Pane: Offered to You */}
                              <div className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-brand-secondary">
                                  {linkedProposal.proposerName} Offers:
                                </span>
                                <div className="text-sm font-black text-white">$ {linkedProposal.offeredCredits}</div>
                                <div className="space-y-0.5 text-gray-400">
                                  {linkedProposal.offeredItems.map(i => (
                                    <div key={i.key}>{i.quantity}x {i.key}</div>
                                  )) || "No Items"}
                                  {linkedProposal.offeredItems.length === 0 && <div className="italic text-[10px]">No commodities</div>}
                                </div>
                              </div>

                              {/* Right Pane: Requested From You */}
                              <div className="space-y-1 border-l border-white/5 pl-4">
                                <span className="text-[9px] font-black uppercase tracking-wider text-brand-tertiary">
                                  Requested From You:
                                </span>
                                <div className="text-sm font-black text-white">$ {linkedProposal.requestedCredits}</div>
                                <div className="space-y-0.5 text-gray-400">
                                  {linkedProposal.requestedItems.map(i => (
                                    <div key={i.key}>{i.quantity}x {i.key}</div>
                                  )) || "No Items"}
                                  {linkedProposal.requestedItems.length === 0 && <div className="italic text-[10px]">No commodities</div>}
                                </div>
                              </div>
                            </div>

                            {/* Trade Resolution Status / Controls */}
                            {linkedProposal.status === "PENDING" ? (
                              <div className="flex items-center gap-2 pt-2">
                                <button
                                  onClick={(e) => handleResolveTrade(e, linkedProposal.documentId, "ACCEPT")}
                                  disabled={resolvingId !== null}
                                  className="flex-1 bg-green-600 hover:bg-green-700 active:scale-95 disabled:opacity-50 text-white font-black py-2 rounded-sm flex items-center justify-center gap-1 transition-all uppercase tracking-widest text-[10px]"
                                >
                                  {resolvingId === linkedProposal.documentId ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Accept Deal
                                </button>
                                <button
                                  onClick={(e) => handleResolveTrade(e, linkedProposal.documentId, "REJECT")}
                                  disabled={resolvingId !== null}
                                  className="flex-1 bg-red-600/20 border border-red-500/30 hover:bg-red-600/40 text-red-400 active:scale-[0.98] disabled:opacity-50 font-black py-2 rounded-sm flex items-center justify-center gap-1 transition-all uppercase tracking-widest text-[10px]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <div className="pt-2 text-center">
                                <span className={`inline-block px-4 py-1.5 rounded-[2px] font-black text-[10px] uppercase tracking-widest ${
                                  linkedProposal.status === "ACCEPTED" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                  linkedProposal.status === "REJECTED" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                                }`}>
                                  [ STATUS: {linkedProposal.status} ]
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Standard notification body text */
                          <div className="p-4 bg-black/60 border border-white/5 font-mono text-[10px] text-gray-300 whitespace-pre-wrap leading-relaxed relative overflow-hidden">
                            {/* Cybersecurity Matrix Grid Lines */}
                            <div className="absolute top-0 right-0 p-1.5 flex items-center gap-1 opacity-25">
                              <Terminal className="h-3 w-3 text-brand-primary" />
                              <span className="text-[6px] tracking-widest">LOG_DECPT</span>
                            </div>
                            
                            {/* Filter out PROPOSAL_ID prefix line from standard text preview */}
                            {isTrade && msg.body.startsWith("PROPOSAL_ID:") 
                              ? msg.body.substring(msg.body.indexOf("\n\n") + 2) 
                              : msg.body}
                          </div>
                        )}

                        {/* Relative timestamp */}
                        <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-mono uppercase tracking-wider">
                          <Calendar className="h-3 w-3" />
                          <span>Received: {formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            onClick={onClose}
            className="w-full h-12 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs border border-white/10 rounded-none"
          >
            Close Inbox
          </Button>
        </div>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-50" />
      </DialogContent>
    </Dialog>
  );
}
