import { NextResponse } from "next/server";
import { strapiFetchList } from "@/lib/cms/strapi";
import { NewsFeedItem } from "@/lib/news/newsFeed";

type StrapiTownNewsAttributes = {
  title?: string;
  excerpt?: string;
  body?: string;
  townId?: string;
  isPinned?: boolean;
  channel?: "town_wire" | "channel_bb";
  authorLabel?: string;
  ctaLabel?: string;
  ctaActionType?: "route" | "external" | "none";
  ctaHref?: string;
  publishedAtGameTime?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

type StrapiTownNewsEntity = {
  id: number | string;
  documentId?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  townId?: string;
  isPinned?: boolean;
  channel?: "town_wire" | "channel_bb";
  authorLabel?: string;
  ctaLabel?: string;
  ctaActionType?: "route" | "external" | "none";
  ctaHref?: string;
  publishedAtGameTime?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  attributes?: StrapiTownNewsAttributes;
};

function toNewsFeedItem(entry: StrapiTownNewsEntity): NewsFeedItem {
  const source = entry.attributes ?? entry;
  const publishedAt =
    source.publishedAtGameTime ??
    source.publishedAt ??
    source.createdAt ??
    new Date().toISOString();

  let cta;
  if (source.ctaActionType && source.ctaActionType !== "none" && source.ctaLabel) {
    cta = {
      label: source.ctaLabel,
      actionType: source.ctaActionType,
      href: source.ctaHref,
    };
  }

  return {
    id: entry.documentId ?? String(entry.id),
    channel: source.channel ?? "town_wire",
    title: source.title ?? "Untitled",
    deck: source.excerpt ?? undefined,
    body: source.body ?? source.excerpt ?? "",
    priority: source.isPinned ? "high" : "normal",
    publishedAt,
    updatedAt: source.updatedAt,
    authorLabel: source.authorLabel ?? (source.channel === "channel_bb" ? "Channel BB" : "Town Wire"),
    cta,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("townId");

  try {
    const townFilter = townId
      ? `&filters[townId][$eq]=${encodeURIComponent(townId)}`
      : "";

    const nowIso = new Date().toISOString();
    const timeFilter = `&filters[publishedAtGameTime][$lte]=${encodeURIComponent(nowIso)}`;

    const payload = await strapiFetchList<StrapiTownNewsEntity>(
      `/api/town-news-items?sort[0]=publishedAtGameTime:desc&pagination[limit]=50${townFilter}${timeFilter}`,
    );

    const mapped = payload.data
      .map(toNewsFeedItem)
      .filter((item) => item.body.trim().length > 0);

    return NextResponse.json({ source: "strapi", items: mapped });
  } catch (error) {
    console.error("GET /api/cms/town-news failed", error);
    return NextResponse.json({ error: "Failed to load town news from Strapi" }, { status: 502 });
  }
}
