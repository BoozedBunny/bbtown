"use server";

import { cookies } from "next/headers";
import { requireSessionUserWithCharacter } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE_NAME, updatePlayerProfile } from "../../lib/strapiAuth";

export async function createCharacter(formData: FormData) {
  const user = await requireSessionUserWithCharacter();

  const name = formData.get("name") as string;
  const appearanceColor = formData.get("appearanceColor") as string;
  const avatar = formData.get("avatar") as string;

  if (!name || !appearanceColor || !avatar) throw new Error("Missing fields");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    throw new Error("Unauthorized");
  }

  await updatePlayerProfile(sessionToken, Number(user.id), {
    displayName: name,
    appearanceColor,
    avatar,
  });
  revalidatePath("/lobby");
  return;
}

export async function updateCharacter(formData: FormData) {
  const user = await requireSessionUserWithCharacter();

  const name = formData.get("name") as string;
  const avatar = formData.get("avatar") as string;
  const description = formData.get("description") as string | null;

  if (!name || !avatar) throw new Error("Missing fields");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    throw new Error("Unauthorized");
  }

  await updatePlayerProfile(sessionToken, Number(user.id), {
    displayName: name,
    avatar,
    description,
  });

  revalidatePath("/lobby");
  revalidatePath("/town/[townId]", "layout");
}
