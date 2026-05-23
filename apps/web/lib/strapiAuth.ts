const DEFAULT_STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1338";

export const AUTH_COOKIE_NAME = "bbtown_session";

type StrapiAuthResponse = {
  jwt: string;
  user: {
    id: number;
    username: string;
    email?: string;
  };
};

type StrapiPlayerProfile = {
  id: number | string;
  documentId?: string;
  displayName?: string;
  appearanceColor?: string;
  avatar?: string;
  description?: string | null;
  wallet?: number;
  arenaMaxRounds?: number;
  experience?: number;
  loanStatus?: "NONE" | "ACTIVE" | "DELINQUENT";
  loanLockedUntil?: string | null;
  lastSoloArenaAt?: string | null;
  user?: number;
  authUserId?: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function strapiRegister(params: {
  username: string;
  email: string;
  password: string;
}) {
  const response = await fetch(`${DEFAULT_STRAPI_BASE_URL}/api/auth/local/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Register failed: ${response.status} ${text}`);
  }

  return (await response.json()) as StrapiAuthResponse;
}

export async function strapiLogin(params: {
  identifier: string;
  password: string;
}) {
  const response = await fetch(`${DEFAULT_STRAPI_BASE_URL}/api/auth/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} ${text}`);
  }

  return (await response.json()) as StrapiAuthResponse;
}

export async function strapiMe(jwt: string) {
  const response = await fetch(`${DEFAULT_STRAPI_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`users/me failed: ${response.status}`);
  }

  return (await response.json()) as { id: number; username: string; email?: string };
}

export async function ensurePlayerProfile(jwt: string, userId: number, username: string) {
  const existing = await fetch(
    `${DEFAULT_STRAPI_BASE_URL}/api/player-profiles?filters[authUserId][$eq]=${userId}&pagination[limit]=1`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    },
  );

  if (existing.ok) {
    const payload = (await existing.json()) as { data?: StrapiPlayerProfile[] };
    if (payload.data && payload.data.length > 0) {
      return payload.data[0];
    }
  }

  const created = await fetch(`${DEFAULT_STRAPI_BASE_URL}/api/player-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      data: {
        authUserId: userId,
        displayName: username,
        appearanceColor: "#BD00FF",
        avatar: "bunny",
        wallet: 1000,
        arenaMaxRounds: 0,
        experience: 0,
        loanStatus: "NONE",
      },
    }),
    cache: "no-store",
  });

  if (!created.ok) {
    const text = await created.text();
    throw new Error(`Profile create failed: ${created.status} ${text}`);
  }

  const payload = (await created.json()) as { data: StrapiPlayerProfile };
  return payload.data;
}

export async function getPlayerProfile(jwt: string, userId: number) {
  const response = await fetch(
    `${DEFAULT_STRAPI_BASE_URL}/api/player-profiles?filters[authUserId][$eq]=${userId}&pagination[limit]=1`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Profile fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: StrapiPlayerProfile[] };
  return payload.data?.[0] ?? null;
}

export async function updatePlayerProfile(
  jwt: string,
  userId: number,
  data: Partial<
    Pick<
      StrapiPlayerProfile,
      "displayName" | "avatar" | "description" | "appearanceColor" | "wallet" | "loanStatus" | "loanLockedUntil" | "experience" | "arenaMaxRounds" | "lastSoloArenaAt"
    >
  >,
) {
  const existing = await getPlayerProfile(jwt, userId);
  if (!existing) {
    throw new Error("Profile not found");
  }

  const profileIdentifier = existing.documentId ?? String(existing.id);

  const response = await fetch(`${DEFAULT_STRAPI_BASE_URL}/api/player-profiles/${profileIdentifier}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile update failed: ${response.status} ${text}`);
  }

  return (await response.json()) as { data: StrapiPlayerProfile };
}

export async function incrementWallet(jwt: string, userId: number, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Amount must be a non-zero number");
  }

  const existing = await getPlayerProfile(jwt, userId);
  if (!existing) {
    throw new Error("Profile not found");
  }

  const currentWallet = typeof existing.wallet === "number" ? existing.wallet : 0;
  const nextWallet = currentWallet + amount;

  if (nextWallet < 0) {
    throw new Error("Insufficient funds");
  }

  await updatePlayerProfile(jwt, userId, { wallet: nextWallet });
  return nextWallet;
}
