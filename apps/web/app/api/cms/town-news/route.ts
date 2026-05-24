import { NextResponse } from "next/server";
import { strapiFetchList } from "@/lib/cms/strapi";
import { getNewsFeedItems, NewsFeedItem } from "@/lib/news/newsFeed";

type StrapiTownNewsAttributes = {
  title?: string;
  excerpt?: string;
  body?: string;
  townId?: string;
  isPinned?: boolean;
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

  return {
    id: entry.documentId ?? String(entry.id),
    channel: "town_wire",
    title: source.title ?? "Untitled",
    deck: source.excerpt ?? undefined,
    body: source.body ?? source.excerpt ?? "",
    priority: source.isPinned ? "high" : "normal",
    publishedAt,
    updatedAt: source.updatedAt,
    authorLabel: "Town Wire",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("townId");

  try {
    const townFilter = townId
      ? `&filters[townId][$eq]=${encodeURIComponent(townId)}`
      : "";

    const payload = await strapiFetchList<StrapiTownNewsEntity>(
      `/api/town-news-items?sort[0]=publishedAtGameTime:desc&pagination[limit]=50${townFilter}`,
    );

    const mapped = payload.data
      .map(toNewsFeedItem)
      .filter((item) => item.body.trim().length > 0);

    return NextResponse.json({ source: "strapi", items: mapped });
  } catch (_error) {
    return NextResponse.json({ source: "fallback", items: getNewsFeedItems() });
  }
}
