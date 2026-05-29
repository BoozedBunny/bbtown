"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { Socket } from "socket.io-client";
import { buildWhisperChannelKey } from "@/lib/chat/channel";
import type { ChatMessage, ChatSendAckPayload } from "@/lib/chat/chatTypes";
import { parseChatInput } from "@/lib/chat/parseChatInput";
import { filterCommandItems, filterRecipients, RecipientItem } from "@/lib/chat/suggestions";
import { ChevronDown, ChevronUp } from "lucide-react";

const normalize = (value: string) => value.trim().toLowerCase();

export function TownChatPanel({
  socket,
  townId,
  currentUsername,
}: {
  socket: Socket | null;
  townId: string;
  currentUserId?: string;
  currentUsername: string | null;
}) {
  const [inputValue, setInputValue] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [knownUsers, setKnownUsers] = useState<Map<string, string>>(new Map());
  const [commandIndex, setCommandIndex] = useState(0);
  const [recipientIndex, setRecipientIndex] = useState(0);
  const [compositionActive, setCompositionActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"town" | "global">("town");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const townRoomId = `town:${townId}`;

  useEffect(() => {
    if (!socket || !currentUsername) return;

    const upsertKnownUser = (id: string | "system", name: string) => {
      if (id === "system") return;
      setKnownUsers((prev) => {
        if (prev.get(id) === name) return prev;
        const next = new Map(prev);
        next.set(id, name);
        return next;
      });
    };

    const onHistory = (payload: { roomId: string; messages: ChatMessage[] }) => {
      if (!payload?.roomId || !Array.isArray(payload.messages)) return;
      payload.messages.forEach((msg) => upsertKnownUser(msg.senderId, msg.senderName));
      setMessages((prev) => {
        const merged = [...prev, ...payload.messages];
        const map = new Map<string, ChatMessage>();
        merged.forEach((msg) => map.set(msg.id, msg));
        return Array.from(map.values())
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .slice(-120);
      });
    };

    const onMessage = (payload: { message: ChatMessage }) => {
      const msg = payload?.message;
      if (!msg) return;
      const isTown = msg.roomId === townRoomId;
      const isGlobal = msg.roomId === "global";
      const isWhisper = msg.roomId.startsWith("whisper:");
      if (!isTown && !isGlobal && !isWhisper) return;
      upsertKnownUser(msg.senderId, msg.senderName);
      setMessages((prev) => [...prev.filter((existing) => existing.id !== msg.id), msg].slice(-120));
    };

    const onAck = (payload: ChatSendAckPayload) => {
      if (payload.accepted) return;
      const map: Record<string, string> = {
        RATE_LIMIT: "Rate limited. Try again.",
        MESSAGE_TOO_LONG: "Message is too long.",
        ROOM_NOT_FOUND: "Chat room not found.",
        NOT_AUTHORIZED: "Not authorized to send.",
        EMPTY_MESSAGE: "Message cannot be empty.",
      };
      setInlineError(map[payload.errorCode] ?? "Failed to send message.");
    };

    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:send:ack", onAck);
    
    // Join and pull history for both Town and Global rooms
    socket.emit("chat:history:request", { roomId: townRoomId, limit: 80 });
    socket.emit("chat:history:request", { roomId: "global", limit: 80 });

    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:send:ack", onAck);
    };
  }, [socket, townRoomId, currentUsername]);

  // Auto-scroll to bottom of chat panel whenever new messages arrive or user switches channel
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeChannel]);

  const commandToken = useMemo(() => {
    if (!inputValue.startsWith("/")) return "";
    return inputValue.trimStart().split(/\s+/)[0] ?? "";
  }, [inputValue]);

  const whisperMatch = useMemo(() => inputValue.match(/^\/w\s*(.*)$/i), [inputValue]);
  const whisperTail = whisperMatch?.[1] ?? "";
  const whisperTokens = whisperTail.trim().split(/\s+/).filter(Boolean);
  const recipientPrefix = whisperTokens[0] ?? "";
  const hasBody = whisperTokens.length >= 2;
  const recipientMode = /^\/w(\s.*)?$/i.test(inputValue) && !hasBody;

  const commandItems = useMemo(() => filterCommandItems(commandToken), [commandToken]);
  const recipientPool: RecipientItem[] = useMemo(() => {
    return Array.from(knownUsers.entries()).map(([playerId, label]) => ({
      playerId,
      label,
      normalizedLabel: normalize(label),
    }));
  }, [knownUsers]);
  const recipientItems = useMemo(
    () => filterRecipients(recipientPool, recipientPrefix, currentUsername ?? null),
    [recipientPool, recipientPrefix, currentUsername],
  );

  const displayedMessages = useMemo(() => {
    return messages.filter((msg) => {
      const isWhisper = msg.roomId.startsWith("whisper:");
      if (isWhisper) return true;
      if (activeChannel === "global") {
        return msg.roomId === "global";
      } else {
        return msg.roomId === townRoomId;
      }
    });
  }, [messages, activeChannel, townRoomId]);

  const commandMenuOpen = inputValue.startsWith("/") && !recipientMode;
  const recipientMenuOpen = recipientMode;
  const selectedCommand = commandItems[Math.max(0, Math.min(commandIndex, commandItems.length - 1))];
  const selectedRecipient = recipientItems[Math.max(0, Math.min(recipientIndex, recipientItems.length - 1))];

  const commitCommand = () => {
    if (!selectedCommand) return;
    if (selectedCommand.command === "/w") {
      setInputValue("/w ");
      setInlineError(null);
      return;
    }
    if (selectedCommand.command === "/help") {
      const helpMessage: ChatMessage = {
        id: `system_help_${Date.now()}`,
        roomId: activeChannel === "global" ? "global" : townRoomId,
        senderId: "system",
        senderName: "SYSTEM",
        body: `=== BBTOWN CHAT HELP ===
• /help : Show this command list
• /w <name> <msg> : Private whisper to a player
• Channel Tabs: Switch between Town and Global chat rooms at the top of the panel
• Bartender NPC: Send a message in Town or Global chat to talk to the Grumpy Bartender!`,
        createdAtMs: Date.now(),
        kind: "system"
      };
      setMessages((prev) => [...prev, helpMessage]);
      setInputValue("");
      setInlineError(null);
    }
  };

  const commitRecipient = () => {
    if (!selectedRecipient) return false;
    setInputValue(`/w ${selectedRecipient.label} `);
    setInlineError(null);
    return true;
  };

  const handleSend = () => {
    if (!socket || !currentUsername) return;
    const parsed = parseChatInput(inputValue);

    if (parsed.kind === "command" && parsed.command === "/help") {
      const helpMessage: ChatMessage = {
        id: `system_help_${Date.now()}`,
        roomId: activeChannel === "global" ? "global" : townRoomId,
        senderId: "system",
        senderName: "SYSTEM",
        body: `=== BBTOWN CHAT HELP ===
• /help : Show this command list
• /w <name> <msg> : Private whisper to a player
• Channel Tabs: Switch between Town and Global chat rooms at the top of the panel
• Bartender NPC: Send a message in Town or Global chat to talk to the Grumpy Bartender!`,
        createdAtMs: Date.now(),
        kind: "system"
      };
      setMessages((prev) => [...prev, helpMessage]);
      setInputValue("");
      setInlineError(null);
      return;
    }

    if (parsed.kind === "command") {
      commitCommand();
      return;
    }
    if (parsed.kind === "invalid") {
      setInlineError(parsed.errors[0]?.message ?? "Invalid command");
      return;
    }

    let roomId = activeChannel === "global" ? "global" : townRoomId;
    let body = parsed.kind === "plain" ? parsed.body.trim() : parsed.body.trim();

    if (parsed.kind === "whisper") {
      const recipient = recipientPool.find((item) => normalize(item.label) === normalize(parsed.recipientToken));
      if (!recipient) {
        setInlineError("Recipient not found in this Town chat roster.");
        return;
      }
      roomId = buildWhisperChannelKey(currentUsername, recipient.playerId);
      body = parsed.body.trim();
      socket.emit("chat:history:request", { roomId, limit: 30 });
    }

    if (!body) return;

    socket.emit("chat:send", {
      roomId,
      body,
      clientNonce: `cn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });

    setInputValue("");
    setInlineError(null);
  };

  return (
    <div className="pointer-events-auto fixed bottom-14 left-4 z-40 w-[min(28rem,calc(100vw-2rem))] cyber-panel border-l-4 border-l-brand-primary p-3 text-white shadow-2xl">
      <div className={`flex items-center justify-between px-1 ${isMinimized ? '' : 'mb-2'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-brand-primary hover:text-white transition-colors"
            title={isMinimized ? "Maximize Chat" : "Minimize Chat"}
          >
            {isMinimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-primary">Chat</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-brand-primary animate-pulse" />
          <div className="w-1.5 h-1.5 bg-brand-primary/30" />
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Channel Selector Tabs */}
          <div className="flex border-b border-white/10 mb-2">
            <button
              onClick={() => setActiveChannel("town")}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                activeChannel === "town"
                  ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                  : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Town Chat
            </button>
            <button
              onClick={() => setActiveChannel("global")}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                activeChannel === "global"
                  ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                  : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Global Chat
            </button>
          </div>

          <div
            ref={chatContainerRef}
            className="mb-3 max-h-40 overflow-y-auto border border-white/5 bg-black/40 p-2 text-[11px] font-mono scrollbar-hide"
          >
            {displayedMessages.length === 0 ? (
              <p className="text-gray-600 uppercase tracking-widest text-[9px]">Initializing feed...</p>
            ) : (
              <ul className="space-y-1.5">
                {displayedMessages.map((message) => {
                  const isWhisper = message.roomId.startsWith("whisper:");
                  const isSystem = message.senderId === "system" || message.kind === "system";
                  return (
                    <li key={message.id} className="leading-relaxed whitespace-pre-wrap">
                      <span className="text-gray-600 text-[9px] mr-1">
                        [{new Date(message.createdAtMs).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]
                      </span>
                      {isSystem ? (
                        <>
                          <span className="font-black uppercase tracking-tighter text-emerald-400">{message.senderName}</span>
                          <span className="text-gray-500 mx-1">»</span>
                          <span className="text-emerald-300 font-semibold">{message.body}</span>
                        </>
                      ) : (
                        <>
                          <span className={`font-black uppercase tracking-tighter ${isWhisper ? "text-brand-secondary" : "text-brand-primary"}`}>
                            {message.senderName}
                          </span>
                          <span className="text-gray-500 mx-1">»</span>
                          <span className={isWhisper ? "text-brand-secondary/90 italic" : "text-gray-300"}>
                            {message.body}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

      <div className="relative">
        <input
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setInlineError(null);
          }}
          onCompositionStart={() => setCompositionActive(true)}
          onCompositionEnd={() => setCompositionActive(false)}
          onKeyDown={(event) => {
            if (compositionActive) return;
            if (event.key === "ArrowDown") {
              if (recipientMenuOpen && recipientItems.length > 0) {
                event.preventDefault();
                setRecipientIndex((prev) => (prev + 1) % recipientItems.length);
              } else if (commandMenuOpen && commandItems.length > 0) {
                event.preventDefault();
                setCommandIndex((prev) => (prev + 1) % commandItems.length);
              }
              return;
            }
            if (event.key === "ArrowUp") {
              if (recipientMenuOpen && recipientItems.length > 0) {
                event.preventDefault();
                setRecipientIndex((prev) => (prev - 1 + recipientItems.length) % recipientItems.length);
              } else if (commandMenuOpen && commandItems.length > 0) {
                event.preventDefault();
                setCommandIndex((prev) => (prev - 1 + commandItems.length) % commandItems.length);
              }
              return;
            }
            if (event.key === "Tab") {
              if (recipientMenuOpen && recipientItems.length > 0) {
                event.preventDefault();
                if (event.shiftKey) {
                  setRecipientIndex((prev) => (prev - 1 + recipientItems.length) % recipientItems.length);
                } else {
                  commitRecipient();
                }
                return;
              }
              if (commandMenuOpen && commandItems.length > 0) {
                event.preventDefault();
                if (event.shiftKey) {
                  setCommandIndex((prev) => (prev - 1 + commandItems.length) % commandItems.length);
                } else {
                  commitCommand();
                }
              }
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (recipientMenuOpen && recipientItems.length > 0 && !hasBody && commitRecipient()) return;
              if (commandMenuOpen && commandItems.length > 0) {
                commitCommand();
                return;
              }
              handleSend();
            }
          }}
          className="w-full bg-black/60 border border-white/10 px-3 py-2.5 text-[11px] text-white font-mono outline-none focus:border-brand-primary  transition-all placeholder:text-gray-700"
          placeholder="CMD INPUT // TYPE / HELP"
          aria-autocomplete={(commandMenuOpen || recipientMenuOpen) ? "list" : "none"}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5 pointer-events-none">
           <div className="w-1 h-3 bg-brand-primary/20" />
           <div className="w-1 h-3 bg-brand-primary/40" />
        </div>
      </div>

          {(commandMenuOpen || recipientMenuOpen) && (
            <div role="listbox" className="mt-2 max-h-40 overflow-y-auto border border-brand-primary/30 bg-[#0F021A] p-1 text-[10px] font-black uppercase tracking-widest ">
              {recipientMenuOpen ? (
                recipientItems.length === 0 ? <div className="px-2 py-1 text-gray-400">No recipients</div> : recipientItems.map((item, index) => (
                  <button
                    key={item.playerId}
                    type="button"
                    role="option"
                    aria-selected={index === recipientIndex}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setRecipientIndex(index);
                      commitRecipient();
                    }}
                    className={`block w-full rounded px-2 py-1 text-left ${index === recipientIndex ? "bg-brand-primary/30" : "hover:bg-white/10"}`}
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                commandItems.length === 0 ? <div className="px-2 py-1 text-gray-400">No commands</div> : commandItems.map((item, index) => (
                  <button
                    key={item.command}
                    type="button"
                    role="option"
                    aria-selected={index === commandIndex}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setCommandIndex(index);
                      commitCommand();
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${index === commandIndex ? "bg-brand-primary/30" : "hover:bg-white/10"}`}
                  >
                    <span>{item.command}</span>
                    <span className="text-xs text-gray-400">{item.help}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {inlineError ? <p className="mt-1 text-xs text-red-400">{inlineError}</p> : null}
        </>
      )}
    </div>
  );
}
