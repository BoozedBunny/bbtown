"use server";

import { prisma } from "../../lib/prisma";
import { getSessionUser } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function createCharacter(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const appearanceColor = formData.get("appearanceColor") as string;

  if (!name || !appearanceColor) throw new Error("Missing fields");

  await prisma.character.create({
    data: {
      name,
      appearanceColor,
      userId: user.id,
    },
  });

  revalidatePath("/lobby");
}
