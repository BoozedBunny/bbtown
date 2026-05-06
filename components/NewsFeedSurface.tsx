"use client";

import { useMemo, useState } from "react";
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

  const refreshFeed = () => {
    try {
      const refreshed = getNewsFeedItems();
      setAllItems(refreshed);
      setLastFetchedAt(new Date().toISOString());
      setError(null);
    } catch (_error) {
      setError("Refresh failed. Showing previously loaded stories.");
    }
  };

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as NewsTab)}>
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="town_wire">Town Wire {unreadCount.town_wire > 0 ? `(${unreadCount.town_wire})` : ""}</TabsTrigger>
            <TabsTrigger value="channel_bb">Channel BB {unreadCount.channel_bb > 0 ? `(${unreadCount.channel_bb})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {mode === "modal" && (
            <Link href={`/town/${townId}/news`} className="text-xs text-gray-300 hover:text-white underline underline-offset-4">
              Open full page
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={refreshFeed} className="text-xs text-gray-300">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {error && <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-md px-3 py-2">{error}</div>}

      <div className="text-[11px] uppercase tracking-widest text-gray-500 flex items-center gap-2">
        <Bell className="w-3 h-3" /> Last update: {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : "--"}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 min-h-0 flex-1">
        <div className="space-y-3 overflow-y-auto pr-1">
          {visibleItems.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
              {selectedTab === "town_wire"
                ? "No active notices right now."
                : selectedTab === "channel_bb"
                  ? "Quiet feed... for now. Check back for fresh buzz."
                  : "No stories available right now."}
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
                  className={`w-full text-left p-4 rounded-xl border ${PRIORITY_CLASS[item.priority]} bg-white/5 hover:bg-white/10 transition ${isRead ? "opacity-75" : "opacity-100"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`inline-flex items-center border px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide mb-2 ${CHANNEL_BADGE_CLASS[item.channel]}`}>
                        {CHANNEL_LABEL[item.channel]}
                      </div>
                      <div className="text-sm font-semibold leading-tight line-clamp-2">{item.title}</div>
                      {item.deck && <div className="mt-1 text-xs text-gray-300 line-clamp-2">{item.deck}</div>}
                    </div>
                    <div className="text-[10px] text-gray-500 whitespace-nowrap">{relativeTimeLabel(item.publishedAt)}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4 overflow-y-auto">
          {!activeItem ? (
            <div className="text-sm text-gray-400">Select a story to read details.</div>
          ) : (
            <div className="space-y-3">
              <div className={`inline-flex items-center border px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${CHANNEL_BADGE_CLASS[activeItem.channel]}`}>
                {CHANNEL_LABEL[activeItem.channel]}
              </div>
              <h3 className="text-lg font-bold leading-tight">{activeItem.title}</h3>
              {activeItem.deck && <p className="text-sm text-gray-300">{activeItem.deck}</p>}
              <div className="text-xs text-gray-500">
                {activeItem.authorLabel ?? "Desk"} • {new Date(activeItem.publishedAt).toLocaleString()}
              </div>
              <div className="text-sm text-gray-200 whitespace-pre-line">{activeItem.body}</div>
              {activeItem.cta && activeItem.cta.actionType !== "none" && activeItem.cta.href ? (
                activeItem.cta.actionType === "external" ? (
                  <a
                    href={activeItem.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-brand-primary hover:underline"
                  >
                    {activeItem.cta.label} <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                ) : (
                  <Link href={activeItem.cta.href} className="inline-flex items-center text-sm text-brand-primary hover:underline">
                    {activeItem.cta.label}
                  </Link>
                )
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
