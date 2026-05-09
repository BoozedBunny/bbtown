import { HARDCODED_BUILDINGS } from "./town-config";

const STATIC_TOWN_ASSETS = [
  "https://www.boozedbunnytown.com/media/textures/testground.png",
  "https://www.boozedbunnytown.com/media/models/bbtown_logo_optimized.glb",
] as const;

export function getTownPreloadManifest() {
  const glbAssets = Array.from(
    new Set(HARDCODED_BUILDINGS.map((building) => building.glb).filter(Boolean)),
  );

  return {
    glbAssets,
    staticAssets: [...STATIC_TOWN_ASSETS],
  };
}
