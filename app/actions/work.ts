"use server";

import { prisma } from "../../lib/prisma";
import { getSessionUser } from "../../lib/auth";
import { revalidatePath } from "next/cache";

export async function doWork(formData?: FormData) {
  const user = await getSessionUser();
  if (!user || !user.character) throw new Error("Unauthorized");

  await prisma.character.update({
    where: { id: user.character.id },
    data: { wallet: { increment: 500 } }
  });

  revalidatePath("/lobby");
  revalidatePath(`/town/1`);
}
