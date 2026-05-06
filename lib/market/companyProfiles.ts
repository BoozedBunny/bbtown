export type MarketCapBand = "SMALL" | "MID" | "LARGE";

export type CompanyProfile = {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  marketCapBand: MarketCapBand;
  volatilityClass: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  hqRegion: string;
  basePrice: number;
  displayOrder: number;
};

export const EXCHANGE_CODE = "BBX";

// Tunable source-of-truth list used by both seed + API metadata fallback.
export const COMPANY_PROFILES: CompanyProfile[] = [
  {
    symbol: "BANA",
    name: "North Banana Foods",
    sector: "Consumer",
    exchange: EXCHANGE_CODE,
    marketCapBand: "MID",
    volatilityClass: "MEDIUM",
    description: "Fictional consumer staples supplier known for resilient snack demand and stable contracts.",
    hqRegion: "Harbor District",
    basePrice: 10,
    displayOrder: 1,
  },
  {
    symbol: "STON",
    name: "Summit Logistics Systems",
    sector: "Industrial",
    exchange: EXCHANGE_CODE,
    marketCapBand: "LARGE",
    volatilityClass: "MEDIUM",
    description: "Freight routing and warehousing network operator powering inter-town distribution lanes.",
    hqRegion: "North Yard",
    basePrice: 69,
    displayOrder: 2,
  },
  {
    symbol: "DOGE",
    name: "Civic Payments Network",
    sector: "Finance",
    exchange: EXCHANGE_CODE,
    marketCapBand: "SMALL",
    volatilityClass: "HIGH",
    description: "Digital settlement rails provider focused on low-fee merchant payments.",
    hqRegion: "Old Exchange",
    basePrice: 4.2,
    displayOrder: 3,
  },
  {
    symbol: "TEAR",
    name: "Apex Wellness Labs",
    sector: "Healthcare",
    exchange: EXCHANGE_CODE,
    marketCapBand: "MID",
    volatilityClass: "LOW",
    description: "Fictional health product research brand with recurring subscription revenue.",
    hqRegion: "East Gardens",
    basePrice: 100,
    displayOrder: 4,
  },
  {
    symbol: "COPE",
    name: "Blue Peak Cloud Systems",
    sector: "Tech",
    exchange: EXCHANGE_CODE,
    marketCapBand: "LARGE",
    volatilityClass: "HIGH",
    description: "Cloud infrastructure and developer tooling platform serving BBTown enterprises.",
    hqRegion: "Skyline Ring",
    basePrice: 50,
    displayOrder: 5,
  },
  {
    symbol: "LOLA",
    name: "Lola Liquor Retail Group",
    sector: "Consumer",
    exchange: EXCHANGE_CODE,
    marketCapBand: "MID",
    volatilityClass: "MEDIUM",
    description: "Regional liquor retail chain with high-margin private labels and busy nightlife storefronts.",
    hqRegion: "Lantern Row",
    basePrice: 23,
    displayOrder: 6,
  },
  {
    symbol: "UBI",
    name: "Ubi Motion Pictures",
    sector: "Media",
    exchange: EXCHANGE_CODE,
    marketCapBand: "SMALL",
    volatilityClass: "HIGH",
    description: "Indie-to-blockbuster film production studio monetizing streaming rights and franchise IP.",
    hqRegion: "Studio Quarter",
    basePrice: 15,
    displayOrder: 7,
  },
  {
    symbol: "BB",
    name: "BB Community Network",
    sector: "Internet",
    exchange: EXCHANGE_CODE,
    marketCapBand: "SMALL",
    volatilityClass: "MEDIUM",
    description: "Web community platform operator focused on creator tools, discussion hubs, and fan economies.",
    hqRegion: "Forum Heights",
    basePrice: 12,
    displayOrder: 8,
  },
];

const profileBySymbol = new Map(COMPANY_PROFILES.map((profile) => [profile.symbol, profile]));

export function getCompanyProfile(symbol: string) {
  return profileBySymbol.get(symbol);
}
