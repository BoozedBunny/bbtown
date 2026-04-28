"use server";

import fs from "fs";
import path from "path";

export async function updateBuildingTransform(buildingId: string, position: [number, number, number], rotationY: number) {
  if (process.env.NODE_ENV !== "development") return { success: false, error: "Not in dev mode" };

  const filePath = path.join(process.cwd(), "app", "town", "[townId]", "page.tsx");
  let content = fs.readFileSync(filePath, "utf-8");

  const idMatch = new RegExp(`id:\s*["']${buildingId}["']`);
  const idIndex = content.search(idMatch);
  if (idIndex === -1) return { success: false, error: "Building not found" };

  // Update Position
  const remainingContent = content.slice(idIndex);
  const positionRegex = /position:\s*\[([^\]]+)\]/;
  const posMatch = positionRegex.exec(remainingContent);
  if (posMatch) {
    const replaceString = `position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`;
    const start = idIndex + posMatch.index;
    const end = start + posMatch[0].length;
    content = content.substring(0, start) + replaceString + content.substring(end);
  }

  // Update Rotation
  const remainingContent2 = content.slice(idIndex);
  const rotRegex = /rotationY:\s*([0-9.-]+)/;
  const rotMatch = rotRegex.exec(remainingContent2);
  if (rotMatch) {
    const replaceString = `rotationY: ${Math.round(rotationY)}`;
    const start = idIndex + rotMatch.index;
    const end = start + rotMatch[0].length;
    content = content.substring(0, start) + replaceString + content.substring(end);
  }

  fs.writeFileSync(filePath, content);
  return { success: true };
}
