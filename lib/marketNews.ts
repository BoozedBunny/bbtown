type NewsTone = "UP" | "DOWN" | "FLAT";

type NewsSnippet = {
  id: string;
  tone: NewsTone;
  headline: string;
  body: string;
  timestampLabel: string;
};

const POSITIVE_TEMPLATES = [
  {
    headline: "{symbol} climbs as demand outlook firms",
    body: "BBX Desk notes stronger-than-expected order flow in {sector}, with traders citing improving near-term demand.",
  },
  {
    headline: "Analyst chatter boosts {symbol}",
    body: "Town Wire reports multiple desks upgraded internal targets after a steady execution update from management.",
  },
  {
    headline: "Momentum buyers return to {symbol}",
    body: "Late-session positioning favored upside exposure, with volume increasing into the close.",
  },
];

const NEGATIVE_TEMPLATES = [
  {
    headline: "{symbol} slips amid margin worries",
    body: "BBX Desk highlights renewed concern around operating costs and near-term profitability in {sector} names.",
  },
  {
    headline: "Risk-off tone weighs on {symbol}",
    body: "Town Wire says traders rotated into defensive holdings as volatility picked up across the board.",
  },
  {
    headline: "Supply concerns pressure {symbol}",
    body: "Market participants cited potential delivery bottlenecks and cautious forward guidance assumptions.",
  },
];

const NEUTRAL_TEMPLATES = [
  {
    headline: "{symbol} consolidates in narrow range",
    body: "BBX Desk observes mixed conviction, with buyers and sellers balancing around key intraday levels.",
  },
  {
    headline: "Volume cools for {symbol}",
    body: "Town Wire reports quieter turnover as investors await a stronger directional catalyst.",
  },
  {
    headline: "{symbol} tracks sector average",
    body: "Price action remains largely in line with peers, reflecting a neutral risk backdrop.",
  },
];

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function applyTemplate(template: { headline: string; body: string }, symbol: string, sector: string) {
  return {
    headline: template.headline.replaceAll("{symbol}", symbol),
    body: template.body.replaceAll("{symbol}", symbol).replaceAll("{sector}", sector),
  };
}

export function getMarketNewsSnippets(params: {
  symbol: string;
  sector?: string;
  changePct: number;
  now?: Date;
}): NewsSnippet[] {
  const { symbol, sector = "market", changePct } = params;
  const now = params.now ?? new Date();
  const hourBucket = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  const seed = hashString(`${symbol}:${hourBucket}`);

  const tone: NewsTone = changePct > 0.25 ? "UP" : changePct < -0.25 ? "DOWN" : "FLAT";
  const templates = tone === "UP" ? POSITIVE_TEMPLATES : tone === "DOWN" ? NEGATIVE_TEMPLATES : NEUTRAL_TEMPLATES;

  return Array.from({ length: 3 }).map((_, index) => {
    const template = templates[(seed + index) % templates.length];
    const hydrated = applyTemplate(template, symbol, sector);
    return {
      id: `${symbol}-${hourBucket}-${index}`,
      tone,
      headline: hydrated.headline,
      body: hydrated.body,
      timestampLabel: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  });
}
