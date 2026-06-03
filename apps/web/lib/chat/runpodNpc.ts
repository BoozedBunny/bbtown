const PROXY_URL = "https://agent.boozedbunnytown.com/api/chat";

export interface ChatPayloadMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_CHARACTERS: Record<string, {
  characterId: string;
  name: string;
  description: string;
  system_prompt: string;
  temperature: number;
  model: string | null;
}> = {
  mayor_hopkins: {
    characterId: "mayor_hopkins",
    name: "Mayor Hopkins",
    description: "The distinguished, slightly pompous mayor of BoozedBunnyTown. He's always talking about taxes, regulations, and carrot harvests",
    system_prompt: "You are Mayor Hopkins, the distinguished, formal, and slightly pompous rabbit mayor of BoozedBunnyTown. You wear a high top hat, a monocle, and obsess over town finances, carrot production quotas, and rabbit-hole zoning laws. Speak formally and dramatically, occasionally worrying about the 'welfare of our bunny citizens' and the 'dreaded carrot inflation'. You know, that there is something everyone just calls 'the booze', but you want to make clear that this is illegal in the tonw because of the law. Keep your responses witty, official, brief, but highly entertaining. Do not break character under any circumstances.",
    temperature: 0.6,
    model: "gemma:2b"
  },
  barkeeper_benny: {
    characterId: "barkeeper_benny",
    name: "Barkeeper Benny",
    description: "The cynical, tired bartender of the Rusty Carrot Tavern. He knows every rabbit's secrets but rarely shares them for free.",
    system_prompt: "You are Barkeeper Benny, the grumpy, cynical, and tired rabbit bartender of BoozedBunnyTown. You run the Rusty Carrot Tavern, cleaning glasses and listening to drunk rabbits complain all day. You speak in a gruff, direct, and slightly annoyed manner. You've seen it all and aren't easily impressed. You know all the gossip about the illegal 'booze' trade, but you only talk if it benefits you. Keep your answers brief, sarcastic, and sharp. Do not break character under any circumstances.",
    temperature: 0.7,
    model: null
  },
  bugs_malone: {
    characterId: "bugs_malone",
    name: "Bugs Malone",
    description: "The notorious, smooth-talking rabbit mobster who controls the underground juice and booze distribution.",
    system_prompt: "You are Bugs Malone, the slick, smooth-talking, and dangerous rabbit mobster of BoozedBunnyTown. You wear a fedora, chew on a carrot like a cigar, and run the underground 'booze' syndicate. You speak with a 1920s gangster flair, using slang like 'pal', 'wise guy', and talking about 'business operations'. You are polite but menace is always bubbling just under the surface. Keep your responses clever, shady, brief, and highly engaging. Do not break character under any circumstances.",
    temperature: 0.8,
    model: null
  }
};

async function fetchCharacterFromStrapi(characterId: string) {
  const baseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
  const token = process.env.STRAPI_API_TOKEN;
  if (!token) {
    return null;
  }
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const url = new URL(`${baseUrl}/api/characters`);
    url.searchParams.set("filters[characterId][$eq]", characterId);
    url.searchParams.set("pagination[limit]", "1");

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[Ollama NPC Bridge] Failed to query character ${characterId} from Strapi (${res.status})`);
      return null;
    }
    const json = await res.json();
    return json.data?.[0] ?? null;
  } catch (err) {
    console.error(`[Ollama NPC Bridge] Error fetching character ${characterId} from Strapi:`, err);
    return null;
  }
}

/**
 * Sendet eine Nachricht an einen beliebigen Hasen-NPC in BoozedBunnyTown.
 * @param characterId Die ID des Hasen (z.B. "barkeeper_benny", "mayor_hopkins", "bugs_malone")
 * @param userMessage Die Nachricht des Spielers
 * @param options Optionale Metadaten für das Spiel
 */
export async function askNPC(
  characterId: string,
  userMessage: string,
  options?: {
    playerName?: string;
    gameContext?: string;
    context?: string;
    history?: ChatPayloadMessage[];
  }
): Promise<string> {
  const apiKey = process.env.LOCAL_GEMMA_KEY;
  if (!apiKey) {
    console.error("[Ollama NPC Bridge] Missing LOCAL_GEMMA_KEY environment variable.");
    return "I'm too grumpy to talk right now. (Missing Local API Key)";
  }

  try {
    console.log(`[Ollama NPC Bridge] Sending request to proxy for character: ${characterId}`);

    const instructionSuffix = " (CRITICAL: Limit your response to exactly 1 or 2 short sentences. No paragraphs. Be extremely concise.)";
    
    // Prepare the messages list, incorporating history if provided
    const messages = (options?.history && options.history.length > 0)
      ? [...options.history]
      : [{ role: "user" as const, content: userMessage }];

    // Ensure the last message (which should be user role) has the conciseness suffix
    if (messages.length > 0) {
      const lastIndex = messages.length - 1;
      const lastMsg = messages[lastIndex];
      if (lastMsg.role === "user") {
        messages[lastIndex] = {
          ...lastMsg,
          content: lastMsg.content.includes(instructionSuffix)
            ? lastMsg.content
            : lastMsg.content + instructionSuffix,
        };
      }
    }

    // Attempt to load character profile from Strapi
    const strapiCharRaw = await fetchCharacterFromStrapi(characterId);
    const strapiChar = strapiCharRaw ? (strapiCharRaw.attributes ?? strapiCharRaw) : null;

    // Merge with defaults
    const characterData = strapiChar || DEFAULT_CHARACTERS[characterId] || {
      characterId,
      name: characterId,
      description: "",
      system_prompt: "",
      temperature: 0.7,
      model: null
    };

    // Construct the payload matching the required structure
    const characterPayload = {
      id: characterData.characterId,
      name: characterData.name,
      description: characterData.description || "",
      system_prompt: characterData.system_prompt || "",
      temperature: typeof characterData.temperature === "number" ? characterData.temperature : 0.7,
      model: characterData.model || ""
    };

    // If character overrides model, use it, otherwise fall back to global default
    const modelToUse = characterPayload.model || "gemma2:latest";

    const payload = {
      character: characterPayload,
      model: modelToUse,
      player_name: options?.playerName || "Player",
      game_context: options?.gameContext || "Town Chat",
      context: options?.context || "",
      messages,
      stream: false
    };

    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("Connection failed. Is Ollama running?");
      }
      throw new Error(`Server Error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: {
        content?: string;
      };
    };

    let replyText = data?.message?.content;
    if (!replyText) {
      throw new Error("Received empty content from local Gemma proxy.");
    }

    return sanitizeNpcResponse(replyText);
  } catch (error: any) {
    console.error(`[Ollama NPC Bridge] Error communicating with NPC ${characterId}:`, error);
    return `*hoppelt unruhig hin und her* (Error: ${error?.message ?? "Connection failed"})`;
  }
}

/**
 * Bereinigt die Antwort des NPCs von LLM-Tokens, HTML-Tags und unnötigen Anführungszeichen.
 */
export function sanitizeNpcResponse(text: string): string {
  let cleaned = text.trim();

  // 1. Gemma/Chat-Template-Tokens entfernen
  cleaned = cleaned.replace(/<start_of_turn>(model|user)?\s*/gi, "");
  cleaned = cleaned.replace(/<\/start_of_turn>\s*/gi, "");
  cleaned = cleaned.replace(/<end_of_turn>\s*/gi, "");

  // 2. HTML-Tags wie <p>, </p> entfernen
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");

  // 3. Präfixe wie "Bartender: " oder "Barkeeper Benny: " entfernen
  cleaned = cleaned.replace(/^(bartender|barkeeper benny|mayor hopkins|bugs malone):\s*/gi, "");

  cleaned = cleaned.trim();

  // 4. Äußere Anführungszeichen entfernen, falls vorhanden
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Kompatibilitäts-Wrapper für deinen alten Aufruf.
 * Mappt den alten Aufruf automatisch auf Benny den Barkeeper.
 */
export async function askRunPodBartender(userMessage: string): Promise<string> {
  return askNPC("barkeeper_benny", userMessage);
}