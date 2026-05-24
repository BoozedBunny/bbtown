import { NextResponse } from "next/server";
import { strapiFetchSingle } from "@/lib/cms/strapi";

type GlobalSetting = {
  gameName?: string;
  loginHeadline?: string;
  maintenanceMode?: boolean;
  newsTicker?: string;
  attributes?: {
    gameName?: string;
    loginHeadline?: string;
    maintenanceMode?: boolean;
    newsTicker?: string;
  };
};

const FALLBACK_SETTING = {
  gameName: "BoozedBunnyTown",
  loginHeadline: "Welcome to the Town",
  maintenanceMode: false,
  newsTicker: "",
};

export async function GET() {
  try {
    const payload = await strapiFetchSingle<GlobalSetting>("/api/global-setting");
    const source = payload.data?.attributes ?? payload.data;

    if (!source) {
      return NextResponse.json({ source: "fallback", setting: FALLBACK_SETTING });
    }

    return NextResponse.json({
      source: "strapi",
      setting: {
        gameName: source.gameName ?? FALLBACK_SETTING.gameName,
        loginHeadline: source.loginHeadline ?? FALLBACK_SETTING.loginHeadline,
        maintenanceMode: source.maintenanceMode ?? FALLBACK_SETTING.maintenanceMode,
        newsTicker: source.newsTicker ?? FALLBACK_SETTING.newsTicker,
      },
    });
  } catch (_error) {
    return NextResponse.json({ source: "fallback", setting: FALLBACK_SETTING });
  }
}
