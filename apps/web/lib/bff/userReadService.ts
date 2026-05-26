const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";

type CharacterPublicProfile = {
  id: string;
  name: string;
  avatar: string;
  description: string | null;
  experience: number;
  arenaMaxRounds: number;
};

function getStrapiServiceHeaders(): HeadersInit {
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getCharacterPublicProfileById(characterId: string): Promise<CharacterPublicProfile | null> {
  const headers = getStrapiServiceHeaders();

  const byDoc = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${encodeURIComponent(characterId)}`, {
    headers,
    cache: "no-store",
  });

  if (byDoc.ok) {
    const payload = (await byDoc.json()) as { data?: any };
    const p = payload.data;
    if (p) {
      return {
        id: p.documentId ?? String(p.id),
        name: p.displayName ?? "",
        avatar: p.avatar ?? "bunny",
        description: p.description ?? null,
        experience: Number(p.experience ?? 0),
        arenaMaxRounds: Number(p.arenaMaxRounds ?? 0),
      };
    }
  }

  const numericId = Number(characterId);
  if (!Number.isFinite(numericId)) return null;

  const byId = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${numericId}`, {
    headers,
    cache: "no-store",
  });
  if (!byId.ok) return null;

  const payload = (await byId.json()) as { data?: any };
  const p = payload.data;
  if (!p) return null;

  return {
    id: p.documentId ?? String(p.id),
    name: p.displayName ?? "",
    avatar: p.avatar ?? "bunny",
    description: p.description ?? null,
    experience: Number(p.experience ?? 0),
    arenaMaxRounds: Number(p.arenaMaxRounds ?? 0),
  };
}
