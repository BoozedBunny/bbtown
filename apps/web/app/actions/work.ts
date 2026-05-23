"use server";

import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";
import { ensureLegacyCharacterForSession, getSessionUser } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE_NAME, incrementWallet } from "../../lib/strapiAuth";

export async function doWork(formData?: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Go to Work is not available in production.");
  }

  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (sessionToken) {
    await incrementWallet(sessionToken, Number(user.id), 500);
  } else {
    const legacyCharacterId = await ensureLegacyCharacterForSession(user);
    await prisma.character.update({
      where: { id: legacyCharacterId },
      data: { wallet: { increment: 500 } }
    });
  }

  revalidatePath("/lobby");
  revalidatePath(`/town/1`);
}
