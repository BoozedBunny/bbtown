"use server";

import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";
import { ensureLegacyCharacterForSession, getSessionUser } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE_NAME, updatePlayerProfile } from "../../lib/strapiAuth";

export async function createCharacter(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const appearanceColor = formData.get("appearanceColor") as string;
  const avatar = formData.get("avatar") as string;

  if (!name || !appearanceColor || !avatar) throw new Error("Missing fields");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (sessionToken) {
    await updatePlayerProfile(sessionToken, Number(user.id), {
      displayName: name,
      appearanceColor,
      avatar,
    });
    revalidatePath("/lobby");
    return;
  }

  await prisma.character.create({
    data: {
      name,
      appearanceColor,
      avatar,
      userId: user.id,
    },
  });

  revalidatePath("/lobby");
}

export async function updateCharacter(formData: FormData) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const avatar = formData.get("avatar") as string;
  const description = formData.get("description") as string | null;

  if (!name || !avatar) throw new Error("Missing fields");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (sessionToken) {
    await updatePlayerProfile(sessionToken, Number(user.id), {
      displayName: name,
      avatar,
      description,
    });
  } else {
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    await prisma.character.update({
      where: { id: legacyCharacterId },
      data: {
        name,
        avatar,
        description,
      },
    });
  }

  revalidatePath("/lobby");
  revalidatePath("/town/[townId]", "layout");
}
