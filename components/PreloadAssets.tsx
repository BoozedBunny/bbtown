"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

// Add all heavy assets here
const assetsToPreload = [
  "https://www.boozedbunnytown.com/media/models/player_bunny.glb",
  "https://www.boozedbunnytown.com/media/models/player_cowie.glb",
  // TODO: Add other heavy models (buildings, environment)
];

export function PreloadAssets() {
  useEffect(() => {
    assetsToPreload.forEach((url) => {
      useGLTF.preload(url);
    });
  }, []);

  return null;
}
