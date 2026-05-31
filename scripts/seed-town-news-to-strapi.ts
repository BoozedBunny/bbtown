const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

type NewsItemSeed = {
  title: string;
  excerpt: string;
  body: string;
  townId: string;
  isPinned?: boolean;
  channel: "town_wire" | "channel_bb";
  authorLabel?: string;
  ctaLabel?: string;
  ctaActionType?: "route" | "external" | "none";
  ctaHref?: string;
  publishedAtGameTime: string; // ISO String
};

const NEWS_SEED: NewsItemSeed[] = [];
const now = new Date();
const daysToSeed = 7;

for (let i = 0; i < daysToSeed; i++) {
  // Dates spread out from now into the future
  const currentDay = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);

  // Morning Article (Town Wire)
  const twDate = new Date(currentDay);
  twDate.setHours(9, 0, 0, 0);

  // Evening Article (Channel BB)
  const bbDate = new Date(currentDay);
  bbDate.setHours(18, 30, 0, 0);

  const articles: NewsItemSeed[] = [
    {
      title: `Town Wire Update: Day ${i + 1}`,
      excerpt: "The latest official updates from the Town Clerk.",
      body: `Notice: Maintenance continues in the North District. \n\nWe also remind citizens to disregard the sensationalist broadcasts from Channel BB. We provide verified facts, not late-night rumors.\n\nAlso, any citizens caught distributing the illegal substance known as "BOOZE" will face severe penalties by order of Mayor Hopkins.`,
      townId: "1",
      channel: "town_wire",
      authorLabel: "Town Clerk Desk",
      publishedAtGameTime: twDate.toISOString(),
      ctaActionType: "route",
      ctaLabel: "Check your finances",
      ctaHref: "?buildingId=26",
    },
    {
      title: `BB Buzz: Neon lights and late nights - Day ${i + 1}`,
      excerpt: "Word on the street vs. Town Hall's boring updates.",
      body: `Spotted: Mayor Hopkins claiming everything is fine while the Arena remains closed for "inspections." \n\nDon't listen to Town Wire's sanitized reports! They won't tell you the real reason why "BOOZE" is supposedly banned. Rumor has it the rich are hoarding it in the Casino.\n\nHot take: Keep your eyes open tonight at the Arena...`,
      townId: "1",
      channel: "channel_bb",
      authorLabel: "BB Studio",
      publishedAtGameTime: bbDate.toISOString(),
      ctaActionType: "route",
      ctaLabel: "Sneak into Arena",
      ctaHref: "?buildingId=21",
    }
  ];

  // Specific jab articles on certain days
  if (i === 2) {
    articles[1] = {
      title: `BB Investigation: The "BOOZE" Cover-up!`,
      excerpt: "Why is the Mayor so afraid of this new trend?",
      body: `Breaking: We've obtained anonymous reports that the supposed ban on "BOOZE" is just to keep the prices artificially high on the Stock Exchange. Don't believe a word Town Wire says when they claim it's a "health hazard." See the stock numbers for yourself!`,
      townId: "1",
      channel: "channel_bb",
      authorLabel: "Channel BB Live",
      publishedAtGameTime: bbDate.toISOString(),
      ctaActionType: "route",
      ctaLabel: "Check Stocks",
      ctaHref: "?buildingId=25",
    };
  }

  if (i === 4) {
    articles[0] = {
      title: `Advisory: Disinformation Campaign by Channel BB`,
      excerpt: "A stern warning from the Mayor's Office.",
      body: `Advisory: Citizens are strongly advised to ignore the recent reckless broadcast by Channel BB regarding the Stock Exchange. The ban on "BOOZE" is strictly enforced for public safety. \n\nChannel BB's attempts to drive citizens to unregulated markets will not be tolerated.`,
      townId: "1",
      channel: "town_wire",
      authorLabel: "Mayor's Office",
      publishedAtGameTime: twDate.toISOString(),
      ctaActionType: "route",
      ctaLabel: "Visit Bank",
      ctaHref: "?buildingId=26",
    };
  }

  if (i === 6) {
    articles[1] = {
      title: `Midnight Casino Heist Rumors?`,
      excerpt: "High rollers getting nervous...",
      body: `Buzz says someone tried to sneak a crate of "BOOZE" into the Casino Pyramid last night. Town Wire claims it was a standard security drill, but our sources say they saw neon-clad runners making off with a heavy stash. \n\nIs the house finally losing?`,
      townId: "1",
      channel: "channel_bb",
      authorLabel: "BB Studio",
      publishedAtGameTime: bbDate.toISOString(),
      ctaActionType: "route",
      ctaLabel: "Check Casino",
      ctaHref: "?buildingId=24",
    };
  }

  NEWS_SEED.push(...articles);
}


async function fetchAllNews(): Promise<any[]> {
  const url = new URL(`${baseUrl}/api/town-news-items`);
  url.searchParams.set("pagination[limit]", "100");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query town news (${res.status})`);
  const json = (await res.json()) as { data?: any[] };
  return json.data ?? [];
}

async function createNewsItem(item: NewsItemSeed) {
  const res = await fetch(`${baseUrl}/api/town-news-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: item }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create news item failed (${res.status}): ${text}`);
  }
}

async function updateNewsItem(identifier: string, item: NewsItemSeed) {
  const res = await fetch(`${baseUrl}/api/town-news-items/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ data: item }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update news item ${item.title} failed (${res.status}): ${text}`);
  }
}

async function main() {
  let created = 0;
  let updated = 0;

  const existingNews = await fetchAllNews();

  for (const item of NEWS_SEED) {
    const existing = existingNews.find(n => n.title === item.title && n.townId === item.townId);

    if (!existing) {
      await createNewsItem(item);
      created += 1;
      console.log(`created news article "${item.title}"`);
      continue;
    }

    const identifier = existing.documentId ?? String(existing.id);
    await updateNewsItem(identifier, item);
    updated += 1;
    console.log(`updated news article "${item.title}"`);
  }

  console.log(`done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
