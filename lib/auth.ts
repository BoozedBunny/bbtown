import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const username = cookieStore.get("mock_user")?.value;

  if (!username) return null;

  const user = await prisma.user.findUnique({
    where: { username },
    include: { character: true },
  });

  return user;
}
