import { strapiFetchList } from "@/lib/cms/strapi";
import type { CompanyProfile, MarketCapBand } from "@/lib/market/companyProfiles";

type StrapiCompanyProfile = {
  id: number | string;
  attributes?: Record<string, unknown>;
  symbol?: string;
  name?: string;
  sector?: string;
  exchange?: string;
  marketCapBand?: MarketCapBand;
  volatilityClass?: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  hqRegion?: string;
  basePrice?: number;
  displayOrder?: number;
};

function normalize(entry: StrapiCompanyProfile): CompanyProfile | null {
  const raw = (entry.attributes ?? entry) as Record<string, unknown>;
  const symbol = typeof raw.symbol === "string" ? raw.symbol.toUpperCase() : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!symbol || !name) return null;

  return {
    symbol,
    name,
    sector: typeof raw.sector === "string" ? raw.sector : "General",
    exchange: typeof raw.exchange === "string" ? raw.exchange : "BBX",
    marketCapBand: raw.marketCapBand === "SMALL" || raw.marketCapBand === "MID" || raw.marketCapBand === "LARGE" ? raw.marketCapBand : "MID",
    volatilityClass: raw.volatilityClass === "LOW" || raw.volatilityClass === "MEDIUM" || raw.volatilityClass === "HIGH" ? raw.volatilityClass : "MEDIUM",
    description: typeof raw.description === "string" ? raw.description : "Fictional listed company in the BBTown market.",
    hqRegion: typeof raw.hqRegion === "string" ? raw.hqRegion : "Central District",
    basePrice: typeof raw.basePrice === "number" ? raw.basePrice : 0,
    displayOrder: typeof raw.displayOrder === "number" ? raw.displayOrder : 100,
  };
}

export async function getCompanyProfileFromCms(symbol: string): Promise<CompanyProfile | null> {
  try {
    const payload = await strapiFetchList<StrapiCompanyProfile>(
      `/api/market-company-profiles?filters[symbol][$eq]=${encodeURIComponent(symbol.toUpperCase())}&pagination[limit]=1`,
    );
    const first = payload.data?.[0];
    if (!first) return null;
    return normalize(first);
  } catch {
    return null;
  }
}
