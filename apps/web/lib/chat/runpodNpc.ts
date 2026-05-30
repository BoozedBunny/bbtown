 const PROXY_URL = "https://agent.boozedbunnytown.com/api/chat";

    /**
     * Sendet eine Nachricht an einen beliebigen Hasen-NPC in BoozedBunnyTown.
     * @param characterId Die ID des Hasen (z.B. "barkeeper_benny", "mayor_hopkins", "bugs_malone")
     * @param userMessage Die Nachricht des Spielers
     */
    export async function askNPC(characterId: string, userMessage: string): Promise<string> {
      const apiKey = process.env.LOCAL_GEMMA_KEY;
      if (!apiKey) {
        console.error("[Ollama NPC Bridge] Missing LOCAL_GEMMA_KEY environment variable.");
        return "I'm too grumpy to talk right now. (Missing Local API Key)";
      }

      try {
        console.log(`[Ollama NPC Bridge] Sending request to proxy for character: ${characterId}`);

        // Wir senden die Anfrage an die charakter-spezifische URL
        const instructionSuffix = " (CRITICAL: Limit your response to exactly 1 or 2 short sentences. No paragraphs. Be extremely concise.)";
        const response = await fetch(`${PROXY_URL}/${characterId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: userMessage + instructionSuffix }],
            stream: false
          })
});

if (!response.ok) {
if (response.status === 503) {
throw new Error("Connection to laptop failed. Is the laptop online and Ollama running?");
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