export type CommandItem = {
  command: "/w" | "/help";
  help: string;
};

export type RecipientItem = {
  playerId: string;
  label: string;
  normalizedLabel: string;
};

export const COMMAND_ITEMS: CommandItem[] = [
  { command: "/w", help: "Whisper: /w <name> <message>" },
  { command: "/help", help: "Show local chat help" },
];

export const filterCommandItems = (query: string): CommandItem[] => {
  const normalizedQuery = query.replace(/^\//, "").toLowerCase();
  if (!normalizedQuery) return COMMAND_ITEMS;
  return COMMAND_ITEMS.filter((item) => item.command.replace(/^\//, "").toLowerCase().startsWith(normalizedQuery));
};

export const filterRecipients = (
  recipients: RecipientItem[],
  prefix: string,
  selfPlayerId: string | null,
): RecipientItem[] => {
  const normalizedPrefix = prefix.trim().toLowerCase();

  return recipients
    .filter((recipient) => recipient.playerId !== selfPlayerId)
    .filter((recipient) => recipient.normalizedLabel.startsWith(normalizedPrefix))
    .sort((a, b) => {
      const aDistance = a.normalizedLabel.length - normalizedPrefix.length;
      const bDistance = b.normalizedLabel.length - normalizedPrefix.length;
      if (aDistance !== bDistance) return aDistance - bDistance;
      if (a.normalizedLabel !== b.normalizedLabel) {
        return a.normalizedLabel.localeCompare(b.normalizedLabel);
      }
      return a.playerId.localeCompare(b.playerId);
    });
};
