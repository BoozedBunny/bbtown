"use server";

import { prisma } from "../../lib/prisma";
import { getSessionUser } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function createCharacter(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const appearanceColor = formData.get("appearanceColor") as string;
  const avatar = formData.get("avatar") as string;

  if (!name || !appearanceColor || !avatar) throw new Error("Missing fields");

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

  if (!name || !avatar) throw new Error("Missing fields");

  await prisma.character.update({
    where: { id: user.character.id },
    data: {
      name,
      avatar,
    },
  });

  revalidatePath("/lobby");
  revalidatePath("/town/[townId]", "layout");
}
