"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNewsFeedItems, NewsChannel, NewsFeedItem, NewsPriority, NewsTab } from "@/lib/news/newsFeed";

type FeedMode = "modal" | "page";

const CHANNEL_LABEL: Record<NewsChannel, string> = {
  town_wire: "Town Wire",
  channel_bb: "Channel BB",
};

const PRIORITY_CLASS: Record<NewsPriority, string> = {
  low: "border-slate-700",
  normal: "border-white/10",
  high: "border-amber-400/70",
  urgent: "border-rose-400",
};

const CHANNEL_BADGE_CLASS: Record<NewsChannel, string> = {
  town_wire: "bg-sky-500/20 text-sky-200 border-sky-300/30",
  channel_bb: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-300/30",
};

function relativeTimeLabel(dateIso: string): string {
  const deltaMs = new Date(dateIso).getTime() - Date.now();
  const abs = Math.abs(deltaMs);
  const minutes = Math.round(abs / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 1) return "just now";
  if (minutes < 60) return rtf.format(deltaMs < 0 ? -minutes : minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(deltaMs < 0 ? -hours : hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(deltaMs < 0 ? -days : days, "day");
}

export function NewsFeedSurface({ mode, townId, initialTab = "all" }: { mode: FeedMode; townId: string; initialTab?: NewsTab }) {
  const [selectedTab, setSelectedTab] = useState<NewsTab>(initialTab);
  const [allItems, setAllItems] = useState<NewsFeedItem[]>(() => getNewsFeedItems());
  const [readItemIds, setReadItemIds] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => (selectedTab === "all" ? allItems : allItems.filter((item) => item.channel === selectedTab)),
    [allItems, selectedTab],
  );

  const unreadCount = useMemo(
    () => ({
      town_wire: allItems.filter((item) => item.channel === "town_wire" && !readItemIds.includes(item.id)).length,
      channel_bb: allItems.filter((item) => item.channel === "channel_bb" && !readItemIds.includes(item.id)).length,
    }),
    [allItems, readItemIds],
  );

  const activeItem = useMemo(() => visibleItems.find((item) => item.id === activeItemId) ?? null, [visibleItems, activeItemId]);

  const markRead = (itemId: string) => {
    setReadItemIds((previous) => (previous.includes(itemId) ? previous : [...previous, itemId]));
  };

  const refreshFeed = async () => {
    try {
      const response = await fetch(`/api/cms/town-news?townId=${encodeURIComponent(townId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch town news");
      const payload = (await response.json()) as { items?: NewsFeedItem[] };
      const refreshed = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : getNewsFeedItems();
      setAllItems(refreshed);
      setLastFetchedAt(new Date().toISOString());
      setError(null);
    } catch (_error) {
      setAllItems(getNewsFeedItems());
      setError("Refresh failed. Showing fallback stories.");
    }
  };

  useEffect(() => {
    void refreshFeed();
  }, [townId]);

  return (
    <div className="h-full w-full flex flex-col gap-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as NewsTab)}>
          <TabsList className="bg-black/40 border border-white/10 p-1 ">
            <TabsTrigger value="all" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest px-6">All</TabsTrigger>
            <TabsTrigger value="town_wire" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest px-6">Wire {unreadCount.town_wire > 0 ? `(${unreadCount.town_wire})` : ""}</TabsTrigger>
            <TabsTrigger value="channel_bb" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest px-6">BB_TV {unreadCount.channel_bb > 0 ? `(${unreadCount.channel_bb})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-4">
          {mode === "modal" && (
            <Link href={`/town/${townId}/news`} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-brand-primary transition-colors">
              [ Full Interface ]
            </Link>
          )}
          <button onClick={refreshFeed} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> RELOAD FEED
          </button>
        </div>
      </div>

      {error && <div className="text-[10px] font-black uppercase tracking-widest text-brand-tertiary bg-brand-tertiary/10 border border-brand-tertiary/30 px-4 py-2 ">{error}</div>}

      <div className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-gray-600 flex items-center gap-2">
        <div className="w-2 h-2 bg-brand-primary animate-pulse" />
        LIVE FEED SYNC: {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : "--"}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 min-h-0 flex-1">
        <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide">
          {visibleItems.length === 0 ? (
            <div className="cyber-panel p-6 border-white/5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                {selectedTab === "town_wire"
                  ? "No encrypted packets found."
                  : selectedTab === "channel_bb"
                    ? "Broadcast signal lost... scanning."
                    : "End of data stream."}
              </p>
            </div>
          ) : (
            visibleItems.map((item) => {
              const isRead = readItemIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveItemId(item.id);
                    markRead(item.id);
                  }}
                  className={`w-full text-left p-5 border-l-4 transition-all relative overflow-hidden  group ${isRead ? "bg-black/20 border-white/5 opacity-60" : "bg-black/60 border-brand-primary hover:border-brand-secondary hover:bg-brand-primary/5"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="relative z-10">
                      <div className={`inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase tracking-widest mb-3 skew-x-[-15deg] border ${item.channel === 'town_wire' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400'}`}>
                        {CHANNEL_LABEL[item.channel]}
                      </div>
                      <div className="text-lg font-black italic tracking-tighter leading-tight group-hover:text-brand-primary transition-colors">{item.title}</div>
                      {item.deck && <div className="mt-2 text-[11px] text-gray-500 font-mono leading-relaxed line-clamp-2">{item.deck}</div>}
                    </div>
                    <div className="text-[9px] font-mono text-gray-600 font-black whitespace-nowrap pt-1">{relativeTimeLabel(item.publishedAt).toUpperCase()}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="cyber-panel bg-black/40 p-6 border-white/5 overflow-y-auto relative scrollbar-hide">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          {!activeItem ? (
            <div className="h-full flex items-center justify-center text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-700 animate-pulse">Select Message</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className={`inline-flex items-center px-3 py-1 text-[9px] font-black uppercase tracking-widest skew-x-[-15deg] border ${activeItem.channel === 'town_wire' ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400'}`}>
                {CHANNEL_LABEL[activeItem.channel]}
              </div>
              <h3 className="text-3xl font-black italic tracking-tighter leading-[0.9] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{activeItem.title}</h3>
              {activeItem.deck && <p className="text-sm text-brand-secondary font-bold leading-relaxed">{activeItem.deck}</p>}

              <div className="h-px bg-white/5 w-full" />

              <div className="text-[10px] font-mono font-black uppercase tracking-widest text-gray-600">
                Source: {activeItem.authorLabel?.toUpperCase() ?? "BB_CENTRAL"} // {new Date(activeItem.publishedAt).toLocaleDateString()}
              </div>

              <div className="text-xs text-gray-400 font-mono leading-relaxed whitespace-pre-line border-l-2 border-white/5 pl-4">{activeItem.body}</div>

              {activeItem.cta && activeItem.cta.actionType !== "none" && activeItem.cta.href ? (
                <div className="pt-4">
                  {activeItem.cta.actionType === "external" ? (
                    <a
                      href={activeItem.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary hover:text-brand-secondary transition-colors"
                    >
                      [ {activeItem.cta.label} ] <ExternalLink className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                    </a>
                  ) : (
                    <Link href={activeItem.cta.href} className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary hover:text-brand-secondary transition-colors">
                      [ {activeItem.cta.label} ]
                    </Link>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
