export type ParseErrorCode = "MISSING_RECIPIENT" | "MISSING_BODY" | "UNKNOWN_COMMAND";

export type ParseError = {
  code: ParseErrorCode;
  message: string;
};

export type ChatParseResult =
  | { kind: "plain"; body: string }
  | { kind: "command"; command: string }
  | { kind: "whisper"; command: "/w"; recipientToken: string; body: string }
  | { kind: "invalid"; command?: string; recipientToken?: string; body?: string; errors: ParseError[] };

const KNOWN_COMMANDS = new Set(["/w", "/help"]);

const tokenizeWithQuotes = (raw: string): string[] => {
  const matches = raw.match(/"([^"]+)"|(\S+)/g) ?? [];
  return matches.map((token) => token.replace(/^"|"$/g, ""));
};

export function parseChatInput(rawText: string): ChatParseResult {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("/")) {
    return { kind: "plain", body: rawText };
  }

  const tokens = tokenizeWithQuotes(trimmed);
  const command = (tokens[0] ?? "").toLowerCase();

  if (!KNOWN_COMMANDS.has(command)) {
    return {
      kind: "invalid",
      command,
      errors: [{ code: "UNKNOWN_COMMAND", message: "Unknown command" }],
    };
  }

  if (command === "/help") {
    return { kind: "command", command };
  }

  const recipientToken = tokens[1]?.trim() ?? "";
  const body = tokens.slice(2).join(" ").trim();
  const errors: ParseError[] = [];

  if (!recipientToken) {
    errors.push({ code: "MISSING_RECIPIENT", message: "Recipient is required for /w" });
  }

  if (!body) {
    errors.push({ code: "MISSING_BODY", message: "Message body is required for /w" });
  }

  if (errors.length > 0) {
    return {
      kind: "invalid",
      command,
      recipientToken,
      body,
      errors,
    };
  }

  return {
    kind: "whisper",
    command: "/w",
    recipientToken,
    body,
  };
}
