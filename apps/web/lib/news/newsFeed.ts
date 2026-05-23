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

const NEWS_FIXTURE: NewsFeedItem[] = [
  {
    id: "tw-001",
    slug: "tram-line-3-night-maintenance",
    channel: "town_wire",
    title: "Scheduled maintenance set for Tram Line 3 tonight",
    deck: "Expect brief service pauses between 23:00 and 00:30 near River Loop.",
    body: "Notice: Tram Line 3 receives track checks from 23:00 to 00:30.\nUpdate: Riders can use Loop Shuttle C at no extra fare.\nEffective: Normal service resumes after clearance.",
    priority: "normal",
    publishedAt: "2026-05-06T17:10:00.000Z",
    authorLabel: "Town Clerk Desk",
    cta: { label: "Check schedule", actionType: "route", href: "/town/transit" },
  },
  {
    id: "bb-001",
    slug: "midnight-neon-rally-buzz",
    channel: "channel_bb",
    title: "Breaking: Neon scooters flood Old Port in a midnight rally",
    deck: "Crowds packed the bridge and the vibes were loud.",
    body: "Spotted: riders in matching chrome helmets lit up Old Port after dark.\nBuzz says two crews are setting up a rematch route tonight.\nHot take: this could be the weekend's wildest photo op.",
    priority: "high",
    publishedAt: "2026-05-06T17:30:00.000Z",
    authorLabel: "BB Studio",
    cta: { label: "See what happened", actionType: "route", href: "/town/events" },
  },
  {
    id: "tw-002",
    channel: "town_wire",
    title: "Advisory: Market plaza fountain closed for water test",
    deck: "Testing window ends before afternoon trading peak.",
    body: "Advisory: The central fountain zone is temporarily fenced for quality checks.\nWho/where: Plaza ring near the north ticker board.\nImpact: Foot traffic is redirected through east and south corridors.",
    priority: "low",
    publishedAt: "2026-05-06T16:45:00.000Z",
    authorLabel: "Utilities Office",
  },
  {
    id: "bb-002",
    channel: "channel_bb",
    title: "Buzz Alert: Arena lobby karaoke duel goes overtime",
    deck: "One mic, two captains, and zero chill.",
    body: "Showdown energy exploded when both squads tied on crowd votes.\nSpotted: improvised backup dancers from the snack line.\nBreaking if true: judges may schedule a sudden-death encore.",
    priority: "normal",
    publishedAt: "2026-05-06T16:20:00.000Z",
    authorLabel: "Channel BB Live",
  },
  {
    id: "tw-003",
    channel: "town_wire",
    title: "Update: South District cargo gate now open",
    deck: "Queued deliveries resumed after scanner reset.",
    body: "Update: The gate scanner has been recalibrated and reopened.\nEffective immediately: cargo routing returns to standard lanes.\nAdvisory: keep permit badges visible for random checks.",
    priority: "urgent",
    publishedAt: "2026-05-06T15:55:00.000Z",
    authorLabel: "Logistics Control",
  },
];

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

export function getNewsFeedItems(): NewsFeedItem[] {
  const validated = NEWS_FIXTURE.map(validateNewsFeedItem).filter((item): item is NewsFeedItem => item !== null);
  return validated.sort((a, b) => {
    const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
}
