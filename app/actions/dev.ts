"use server";

import fs from "fs";
import path from "path";

export async function updateBuildingTransform(buildingId: string, position: [number, number, number], rotationY: number) {
  if (process.env.NODE_ENV !== "development") return { success: false, error: "Not in dev mode" };

  const filePath = path.join(process.cwd(), "app", "town", "[townId]", "page.tsx");
  let content = fs.readFileSync(filePath, "utf-8");

  // Find the exact ID string (e.g. id: "1",)
  const idStr = `id: "${buildingId}"`;
  let idIndex = content.indexOf(idStr);
  if (idIndex === -1) {
    // Fallback if formatting is slightly different
    const idMatch = new RegExp(`id:\\s*["']${buildingId}["']`);
    idIndex = content.search(idMatch);
    if (idIndex === -1) return { success: false, error: "Building not found" };
  }

  // Update Position
  let remainingContent = content.slice(idIndex);
  let positionRegex = /position:\s*\[([^\]]+)\]/;
  let posMatch = positionRegex.exec(remainingContent);
  if (posMatch) {
    const replaceString = `position: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`;
    const start = idIndex + posMatch.index;
    const end = start + posMatch[0].length;
    content = content.substring(0, start) + replaceString + content.substring(end);
  }

  // Update Rotation (we must re-calculate idIndex because the position replacement might have shifted string lengths)
  idIndex = content.indexOf(idStr);
  if (idIndex === -1) {
    const idMatch = new RegExp(`id:\\s*["']${buildingId}["']`);
    idIndex = content.search(idMatch);
  }
  
  if (idIndex !== -1) {
    let remainingContent2 = content.slice(idIndex);
    let rotRegex = /rotationY:\s*([0-9.-]+)/;
    let rotMatch = rotRegex.exec(remainingContent2);
    if (rotMatch) {
      const replaceString = `rotationY: ${Math.round(rotationY)}`;
      const start = idIndex + rotMatch.index;
      const end = start + rotMatch[0].length;
      content = content.substring(0, start) + replaceString + content.substring(end);
    }
  }

  fs.writeFileSync(filePath, content);
  return { success: true };
}
