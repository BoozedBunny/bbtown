"use server";

import { cookies } from "next/headers";
import { requireSessionUserWithCharacter } from "../../lib/auth";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE_NAME, incrementWallet } from "../../lib/strapiAuth";

export async function doWork(formData?: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Go to Work is not available in production.");
  }

  const user = await requireSessionUserWithCharacter();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    throw new Error("Unauthorized");
  }

  await incrementWallet(sessionToken, Number(user.id), 500);

  revalidatePath("/lobby");
  revalidatePath(`/town/1`);
}
