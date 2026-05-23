export type ChatMessageKind = "user" | "system" | "moderation";

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string | "system";
  senderName: string;
  body: string;
  createdAtMs: number;
  clientNonce?: string;
  kind: ChatMessageKind;
};

export type ClientMessageRef = {
  clientNonce: string;
  body: string;
  enqueuedAtMs: number;
  status: "sending" | "failed";
  retryCount: number;
};

export type ChatSendPayload = {
  roomId: string;
  body: string;
  clientNonce: string;
};

export type ChatHistoryRequestPayload = {
  roomId: string;
  beforeMessageId?: string;
  limit?: number;
};

export type ChatReadUpsertPayload = {
  roomId: string;
  lastReadMessageId: string;
};

export type ChatSendAckPayload =
  | {
      clientNonce: string;
      messageId: string;
      accepted: true;
      errorCode: null;
    }
  | {
      clientNonce: string;
      accepted: false;
      errorCode: "RATE_LIMIT" | "MESSAGE_TOO_LONG" | "ROOM_NOT_FOUND" | "NOT_AUTHORIZED" | "EMPTY_MESSAGE";
    };
