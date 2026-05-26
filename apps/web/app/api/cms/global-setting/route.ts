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

export async function GET() {
  try {
    const payload = await strapiFetchSingle<GlobalSetting>("/api/global-setting");
    const source = payload.data?.attributes ?? payload.data;

    if (!source) {
      return NextResponse.json({ error: "Global setting not found in Strapi" }, { status: 500 });
    }

    return NextResponse.json({
      source: "strapi",
      setting: {
        gameName: source.gameName,
        loginHeadline: source.loginHeadline,
        maintenanceMode: source.maintenanceMode,
        newsTicker: source.newsTicker,
      },
    });
  } catch (error) {
    console.error("GET /api/cms/global-setting failed", error);
    return NextResponse.json({ error: "Failed to load global setting from Strapi" }, { status: 502 });
  }
}
