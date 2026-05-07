export type ChatChannelType = "GLOBAL" | "TOWN" | "WHISPER";

export type ChannelRef = {
  key: string;
  type: ChatChannelType;
  label: string;
  colorToken: "chat.channel.global" | "chat.channel.town" | "chat.channel.whisper";
  meta?: {
    townId?: string;
    shardId?: string;
    peerUserId?: string;
    peerDisplayName?: string;
  };
};

export type ChatMessage = {
  messageId: string;
  channel: string;
  senderUserId: string;
  senderName: string;
  body: string;
  mentions: string[];
  sentAt: string;
};

export const GLOBAL_CHANNEL_KEY = "global";

export const buildTownChannelKey = (townId: string, shardId: string): string => `town:${townId}:${shardId}`;

export const buildWhisperChannelKey = (userA: string, userB: string): string => {
  const [left, right] = [userA, userB].sort();
  return `whisper:${left}:${right}`;
};

export const parseChannelType = (channelKey: string): ChatChannelType | null => {
  if (channelKey === GLOBAL_CHANNEL_KEY) return "GLOBAL";
  if (channelKey.startsWith("town:")) return "TOWN";
  if (channelKey.startsWith("whisper:")) return "WHISPER";
  return null;
};

export const channelLabelForKey = (
  channelKey: string,
  opts?: { currentUserId?: string; usernameById?: Record<string, string> },
): string => {
  const type = parseChannelType(channelKey);
  if (type === "GLOBAL") return "Global";
  if (type === "TOWN") return "Town";
  if (type === "WHISPER") {
    const [, userA, userB] = channelKey.split(":");
    const peerId = opts?.currentUserId && userA === opts.currentUserId ? userB : userA;
    const peerName = peerId ? opts?.usernameById?.[peerId] : null;
    return `Whisper @${peerName ?? peerId ?? "user"}`;
  }
  return channelKey;
};
