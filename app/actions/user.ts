"use server";

import { getSessionUser } from "../../lib/auth";

export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user || !user.character) return null;
  return {
    id: user.id,
    username: user.username,
    character: user.character,
  };
}
