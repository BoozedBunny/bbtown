"use server";

import fs from "fs";
import path from "path";

export async function updateBuildingPosition(buildingId: string, position: [number, number, number]) {
  if (process.env.NODE_ENV !== "development") return { success: false, error: "Not in dev mode" };

  const filePath = path.join(process.cwd(), "app", "town", "[townId]", "page.tsx");
  let content = fs.readFileSync(filePath, "utf-8");

  const idMatch = new RegExp(`id:\\s*["']${buildingId}["']`);
  const idIndex = content.search(idMatch);
  if (idIndex === -1) return { success: false, error: "Building not found" };

  const remainingContent = content.slice(idIndex);
  const positionRegex = /position:\s*\[([^\]]+)\]/;
  const match = positionRegex.exec(remainingContent);
  if (match) {
    const replaceString = `position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`;
    const start = idIndex + match.index;
    const end = start + match[0].length;
    content = content.substring(0, start) + replaceString + content.substring(end);
    fs.writeFileSync(filePath, content);
    return { success: true };
  }
  return { success: false, error: "Position not found" };
}
