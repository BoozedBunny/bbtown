import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  getPlayerProfile,
  strapiMe,
} from "./strapiAuth";

export type SessionUser = {
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

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

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

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  const strapiToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (strapiToken) {
    const strapiUser = await getSessionUserFromStrapi(strapiToken);
    if (strapiUser) return strapiUser;
  }

  return null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function requireSessionUserWithCharacter(): Promise<SessionUser & { character: NonNullable<SessionUser["character"]> }> {
  const user = await requireSessionUser();
  if (!user.character) {
    throw new UnauthorizedError();
  }
  return user as SessionUser & { character: NonNullable<SessionUser["character"]> };
}

export async function ensureLegacyCharacterForSession(user: SessionUser): Promise<string> {
  if (!user.character) {
    throw new UnauthorizedError();
  }

  // Strapi ist Source-of-Truth: Session-Character-ID direkt verwenden,
  // kein Legacy-Bootstrap/Auto-Create mehr.
  return user.character.id;
}
