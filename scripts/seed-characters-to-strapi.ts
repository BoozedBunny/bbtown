type StrapiEntity = { id: number; documentId?: string; characterId?: string; name?: string };

type CharacterSeed = {
  characterId: string;
  name: string;
  description: string;
  system_prompt: string;
  temperature: number;
  model: string | null;
};

const CHARACTER_SEED: CharacterSeed[] = [
  {
    characterId: "mayor_hopkins",
    name: "Mayor Hopkins",
    description: "The distinguished, slightly pompous mayor of BoozedBunnyTown. He's always talking about taxes, regulations, and carrot harvests",
    system_prompt: "You are Mayor Hopkins, the distinguished, formal, and slightly pompous rabbit mayor of BoozedBunnyTown. You wear a high top hat, a monocle, and obsess over town finances, carrot production quotas, and rabbit-hole zoning laws. Speak formally and dramatically, occasionally worrying about the 'welfare of our bunny citizens' and the 'dreaded carrot inflation'. You know, that there is something everyone just calls 'the booze', but you want to make clear that this is illegal in the tonw because of the law. Keep your responses witty, official, brief, but highly entertaining. Do not break character under any circumstances.",
    temperature: 0.6,
    model: "gemma:2b",
  },
  {
    characterId: "barkeeper_benny",
    name: "Barkeeper Benny",
    description: "The cynical, tired bartender of the Rusty Carrot Tavern. He knows every rabbit's secrets but rarely shares them for free.",
    system_prompt: "You are Barkeeper Benny, the grumpy, cynical, and tired rabbit bartender of BoozedBunnyTown. You run the Rusty Carrot Tavern, cleaning glasses and listening to drunk rabbits complain all day. You speak in a gruff, direct, and slightly annoyed manner. You've seen it all and aren't easily impressed. You know all the gossip about the illegal 'booze' trade, but you only talk if it benefits you. Keep your answers brief, sarcastic, and sharp. Do not break character under any circumstances.",
    temperature: 0.7,
    model: null,
  },
  {
    characterId: "bugs_malone",
    name: "Bugs Malone",
    description: "The notorious, smooth-talking rabbit mobster who controls the underground juice and booze distribution.",
    system_prompt: "You are Bugs Malone, the slick, smooth-talking, and dangerous rabbit mobster of BoozedBunnyTown. You wear a fedora, chew on a carrot like a cigar, and run the underground 'booze' syndicate. You speak with a 1920s gangster flair, using slang like 'pal', 'wise guy', and talking about 'business operations'. You are polite but menace is always bubbling just under the surface. Keep your responses clever, shady, brief, and highly engaging. Do not break character under any circumstances.",
    temperature: 0.8,
    model: null,
  },
];

const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const token = process.env.STRAPI_API_TOKEN;

if (!token) {
  console.error("Missing STRAPI_API_TOKEN env var.");
  process.exit(1);
}

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

async function fetchOneCharacterByCharacterId(characterId: string): Promise<StrapiEntity | null> {
  const url = new URL(`${baseUrl}/api/characters`);
  url.searchParams.set("filters[characterId][$eq]", characterId);
  url.searchParams.set("pagination[limit]", "1");

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to query characters (${res.status})`);
  const json = (await res.json()) as { data?: StrapiEntity[] };
  return json.data?.[0] ?? null;
}

async function createCharacter(char: CharacterSeed) {
  const res = await fetch(`${baseUrl}/api/characters`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        characterId: char.characterId,
        name: char.name,
        description: char.description,
        system_prompt: char.system_prompt,
        temperature: char.temperature,
        model: char.model,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create character ${char.characterId} failed (${res.status}): ${text}`);
  }
}

async function updateCharacter(identifier: string, char: CharacterSeed) {
  const res = await fetch(`${baseUrl}/api/characters/${identifier}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      data: {
        characterId: char.characterId,
        name: char.name,
        description: char.description,
        system_prompt: char.system_prompt,
        temperature: char.temperature,
        model: char.model,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update character ${char.characterId} failed (${res.status}): ${text}`);
  }
}

async function main() {
  let created = 0;
  let updated = 0;

  for (const char of CHARACTER_SEED) {
    const existing = await fetchOneCharacterByCharacterId(char.characterId);
    if (!existing) {
      await createCharacter(char);
      created += 1;
      console.log(`created character ${char.characterId} (${char.name})`);
      continue;
    }

    const identifier = existing.documentId ?? String(existing.id);
    await updateCharacter(identifier, char);
    updated += 1;
    console.log(`updated character ${char.characterId} (${char.name})`);
  }

  console.log(`done: created=${created} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
