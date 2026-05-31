export type NewsChannel = "town_wire" | "channel_bb";
export type NewsTab = "all" | NewsChannel;
export type NewsPriority = "low" | "normal" | "high" | "urgent";

export interface NewsFeedItem {
  id: string;
  slug?: string;
  channel: NewsChannel;
  title: string;
  deck?: string;
  body: string;
  tags?: string[];
  priority: NewsPriority;
  publishedAt: string;
  updatedAt?: string;
  expiresAt?: string;
  authorLabel?: string;
  cta?: {
    label: string;
    actionType: "route" | "external" | "none";
    href?: string;
  };
}

export interface NewsFeedState {
  mode: "modal" | "page";
  selectedTab: NewsTab;
  items: NewsFeedItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  unreadCountByChannel: Record<NewsChannel, number>;
  readItemIds: string[];
  hasMore: boolean;
}

type UnknownRecord = Record<string, unknown>;

const channelSet = new Set<NewsChannel>(["town_wire", "channel_bb"]);
const prioritySet = new Set<NewsPriority>(["low", "normal", "high", "urgent"]);

const isIsoDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

export function validateNewsFeedItem(input: unknown): NewsFeedItem | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as UnknownRecord;

  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.title !== "string" || raw.title.length === 0) return null;
  if (typeof raw.body !== "string" || raw.body.length === 0) return null;
  if (!channelSet.has(raw.channel as NewsChannel)) return null;
  if (!prioritySet.has(raw.priority as NewsPriority)) return null;
  if (!isIsoDate(raw.publishedAt)) return null;
  if (raw.expiresAt && !isIsoDate(raw.expiresAt)) return null;
  if (raw.updatedAt && !isIsoDate(raw.updatedAt)) return null;

  if (typeof raw.expiresAt === "string" && new Date(raw.expiresAt).getTime() < Date.now()) return null;

  return {
    id: raw.id,
    slug: typeof raw.slug === "string" ? raw.slug : undefined,
    channel: raw.channel as NewsChannel,
    title: raw.title,
    deck: typeof raw.deck === "string" ? raw.deck : undefined,
    body: raw.body,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    priority: raw.priority as NewsPriority,
    publishedAt: raw.publishedAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : undefined,
    authorLabel: typeof raw.authorLabel === "string" ? raw.authorLabel : undefined,
    cta:
      raw.cta && typeof raw.cta === "object"
        ? {
            label: typeof (raw.cta as UnknownRecord).label === "string" ? ((raw.cta as UnknownRecord).label as string) : "",
            actionType:
              (raw.cta as UnknownRecord).actionType === "route" ||
              (raw.cta as UnknownRecord).actionType === "external" ||
              (raw.cta as UnknownRecord).actionType === "none"
                ? ((raw.cta as UnknownRecord).actionType as "route" | "external" | "none")
                : "none",
            href: typeof (raw.cta as UnknownRecord).href === "string" ? ((raw.cta as UnknownRecord).href as string) : undefined,
          }
        : undefined,
  };
}

