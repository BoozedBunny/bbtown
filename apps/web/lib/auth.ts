import { cookies } from "next/headers";
import { prisma } from "./prisma";
import {
  AUTH_COOKIE_NAME,
  getPlayerProfile,
  strapiMe,
} from "./strapiAuth";

type SessionUser = {
  id: string;
  username: string;
  character: {
    id: string;
    name: string;
    avatar: string;
    description: string | null;
    wallet: number;
    arenaMaxRounds: number;
    experience: number;
    appearanceColor?: string;
    loanStatus?: "NONE" | "ACTIVE" | "DELINQUENT";
    loanLockedUntil?: Date | null;
    lastSoloArenaAt?: Date | null;
  } | null;
};

async function getSessionUserFromStrapi(token: string): Promise<SessionUser | null> {
  try {
    const me = await strapiMe(token);
    const profile = await getPlayerProfile(token, me.id);

    if (!profile) {
      return {
        id: String(me.id),
        username: me.username,
        character: null,
      };
    }

    return {
      id: String(me.id),
      username: me.username,
      character: {
        id: String(profile.id),
        name: profile.displayName ?? me.username,
        avatar: profile.avatar ?? "bunny",
        description: profile.description ?? null,
        wallet: profile.wallet ?? 1000,
        arenaMaxRounds: profile.arenaMaxRounds ?? 0,
        experience: profile.experience ?? 0,
        appearanceColor: profile.appearanceColor,
        loanStatus: profile.loanStatus,
        loanLockedUntil: profile.loanLockedUntil ? new Date(profile.loanLockedUntil) : null,
        lastSoloArenaAt: profile.lastSoloArenaAt ? new Date(profile.lastSoloArenaAt) : null,
      },
    };
  } catch {
    return null;
  }
}

async function getSessionUserFromLegacyMock(mockUsername: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { username: mockUsername },
    include: { character: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    character: user.character
      ? {
          id: user.character.id,
          name: user.character.name,
          avatar: user.character.avatar,
          description: user.character.description,
          wallet: user.character.wallet,
          arenaMaxRounds: user.character.arenaMaxRounds,
          experience: user.character.experience,
          appearanceColor: user.character.appearanceColor,
          loanStatus: user.character.loanStatus,
          loanLockedUntil: user.character.loanLockedUntil,
          lastSoloArenaAt: user.character.lastSoloArenaAt,
        }
      : null,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const strapiToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (strapiToken) {
    const strapiUser = await getSessionUserFromStrapi(strapiToken);
    if (strapiUser) return strapiUser;
  }

  const legacyUsername = cookieStore.get("mock_user")?.value;
  if (!legacyUsername) return null;

  return getSessionUserFromLegacyMock(legacyUsername);
}
