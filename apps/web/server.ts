import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { COMPANY_PROFILES } from "./lib/market/companyProfiles";
import { runTreasuryDailySettlement } from "./lib/treasury/treasuryService";
import { runLoanDelinquencySweep } from "./lib/treasury/loanService";
import { PostMatchEntry, setGlobalToplist } from "./lib/arena/toplist";
import {
  DEFAULT_ROUND_TRANSITION_CONFIG,
  getRoundPhaseStateAt,
} from "./lib/arena/roundPhases";
import { GLOBAL_CHANNEL_KEY } from "./lib/chat/channel";
import type {
  ChatHistoryRequestPayload,
  ChatMessage,
  ChatReadUpsertPayload,
  ChatSendAckPayload,
  ChatSendPayload,
} from "./lib/chat/chatTypes";
import { getPlayerProfile, strapiMe, updatePlayerProfile } from "./lib/strapiAuth";
import {
  applyArenaResult,
  buyStockForCharacter,
  ensureCompanyStocksFromProfiles,
  getAvatarForUsername,
  getCharacterById,
  sellStockForCharacter,
  tickStocksAndReturnSorted,
  upsertLegacyCharacterForUsername,
} from "./lib/bff/serverRuntimeService";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const ROUND_DURATION_SECONDS = 30;
const TOTAL_ROUNDS = 30;

const app = (next as any)({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await ensureCompanyStocksFromProfiles(COMPANY_PROFILES);

  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  // Arena Matchmaking Queue
  const matchmakingQueue: { socketId: string; username: string }[] = [];
  const chatSubscriptionsBySocket = new Map<string, Set<string>>();
  const chatSocketsByUser = new Map<string, Set<string>>();
  const chatMessageHistory = new Map<
    string,
    Array<{
      messageId: string;
      channel: string;
      senderUserId: string;
      senderName: string;
      body: string;
      mentions: string[];
      sentAt: string;
    }>
  >();

  const canAccessChatChannel = (
    username: string | undefined,
    channelKey: string,
  ): boolean => {
    if (channelKey === GLOBAL_CHANNEL_KEY) return true;
    if (channelKey.startsWith("town:")) return true;
    if (!channelKey.startsWith("whisper:")) return false;
    if (!username) return false;
    const [, userA, userB] = channelKey.split(":");
    return userA === username || userB === username;
  };

  const appendChatHistory = (
    channelKey: string,
    message: {
      messageId: string;
      channel: string;
      senderUserId: string;
      senderName: string;
      body: string;
      mentions: string[];
      sentAt: string;
    },
  ) => {
    const rows = chatMessageHistory.get(channelKey) ?? [];
    rows.push(message);
    chatMessageHistory.set(channelKey, rows.slice(-200));
  };

  interface PlayerState {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    anim: string;
    spawnReason: "initial_join" | "respawn" | "landing_reset" | "zone_transfer";
    spawnSequence: number;
    avatar: string;
  }

  type SpawnFinalizeReason = PlayerState["spawnReason"];

  interface JoinArenaRoomPayload {
    roomId: string;
    cameraYaw?: number;
  }

  interface Obstacle {
    id: string;
    type: "beam";
    position: [number, number, number];
    speed: number;
    width: number;
  }

  interface GameSession {
    roomId: string;
    players: Record<string, PlayerState>;
    obstacles: Obstacle[];
    status: "waiting" | "playing" | "finished";
    timer: number;
    startedAtMs?: number;
    roundIndex?: number;
    roundPhase?: string;
    phaseStartTimeMs?: number;
    phaseDurationMs?: number;
    obstaclesEnabled?: boolean;
    nextActiveStartTimeMs?: number;
    intervalId?: NodeJS.Timeout;
    nextSpawnSequence: number;
  }

  const games: Record<string, GameSession> = {};

  type ChatRoomState = {
    messages: ChatMessage[];
    readStateByUser: Map<string, string>;
    sendTimestampsByUser: Map<string, number[]>;
  };

  const chatRooms = new Map<string, ChatRoomState>();
  const CHAT_RATE_LIMIT_COUNT = 5;
  const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;
  const CHAT_MAX_HISTORY = 10_000;

  const getChatRoom = (roomId: string): ChatRoomState => {
    let room = chatRooms.get(roomId);
    if (!room) {
      room = {
        messages: [],
        readStateByUser: new Map(),
        sendTimestampsByUser: new Map(),
      };
      chatRooms.set(roomId, room);
    }
    return room;
  };

  const sortChatMessages = (messages: ChatMessage[]) =>
    messages.sort((a, b) =>
      a.createdAtMs === b.createdAtMs
        ? a.id.localeCompare(b.id)
        : a.createdAtMs - b.createdAtMs,
    );

  const emitChatAck = (
    targetSocket: {
      emit: (event: string, payload: ChatSendAckPayload) => void;
    },
    payload: ChatSendAckPayload,
  ) => {
    targetSocket.emit("chat:send:ack", payload);
  };

  const spawnOrientationAwayFromCameraEnabled =
    process.env.SPAWN_ORIENTATION_AWAY_FROM_CAMERA !== "0";
  const spawnSlotAllocatorEnabled =
    process.env.SPAWN_MP_SLOT_ALLOCATOR_V1 !== "0";
  const spawnSpacing = Number.parseFloat(
    process.env.SPAWN_MP_SPACING_METERS ?? "1.5",
  );

  const normalizeAngle = (angle: number) => {
    let normalized = angle % (Math.PI * 2);
    if (normalized <= -Math.PI) normalized += Math.PI * 2;
    if (normalized > Math.PI) normalized -= Math.PI * 2;
    return normalized;
  };

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const slotOffsetForIndex = (slotIndex: number) => {
    if (slotIndex <= 0) return 0;
    const magnitude = Math.ceil(slotIndex / 2);
    const sign = slotIndex % 2 === 1 ? 1 : -1;
    return sign * magnitude;
  };

  const getSpawnYaw = (cameraYaw?: number) => {
    if (!spawnOrientationAwayFromCameraEnabled) {
      return 0;
    }
    if (!isFiniteNumber(cameraYaw)) {
      return Math.PI;
    }
    return normalizeAngle(cameraYaw + Math.PI);
  };

  const computeSpawnPosition = (
    slotIndex: number,
  ): [number, number, number] => {
    if (!spawnSlotAllocatorEnabled) {
      return [slotIndex === 0 ? -2 : 2, 0, 0];
    }
    const offset = slotOffsetForIndex(slotIndex) * spawnSpacing;
    return [offset, 0, 0];
  };

  const buildSpawnPlayerState = (
    socketId: string,
    username: string,
    slotIndex: number,
    reason: SpawnFinalizeReason,
    cameraYaw?: number,
    forcedSequence?: number,
    avatar: string = "bunny",
  ): PlayerState => {
    const sequence = forcedSequence ?? Date.now();
    return {
      id: socketId,
      username,
      position: computeSpawnPosition(slotIndex),
      rotation: getSpawnYaw(cameraYaw),
      anim: "Idle_1",
      spawnReason: reason,
      spawnSequence: sequence,
      avatar,
    };
  };

  const spawnObstacle = (game: GameSession) => {
    const id = `obs-${Math.random().toString(36).substring(2, 7)}`;
    // Spawn at z = -15 or 15 and move across
    const side = Math.random() > 0.5 ? 1 : -1;
    const obstacle: Obstacle = {
      id,
      type: "beam",
      position: [0, 0.5, side * 15],
      speed: side * -0.1, // Move towards center
      width: 10,
    };
    game.obstacles.push(obstacle);
  };

  const updateGame = (roomId: string) => {
    const game = games[roomId];
    if (game && game.status === "playing") {
      const nowMs = Date.now();
      const startedAtMs = game.startedAtMs ?? nowMs;
      const phaseState = getRoundPhaseStateAt(
        nowMs,
        startedAtMs,
        DEFAULT_ROUND_TRANSITION_CONFIG,
      );
      game.roundIndex = phaseState.roundIndex;
      game.roundPhase = phaseState.phase;
      game.phaseStartTimeMs = phaseState.phaseStartTimeMs;
      game.phaseDurationMs = phaseState.phaseDurationMs;
      game.obstaclesEnabled = phaseState.obstaclesEnabled;
      game.nextActiveStartTimeMs = phaseState.nextActiveStartTimeMs;

      if (phaseState.obstaclesEnabled) {
        game.obstacles = game.obstacles.filter((obs) => {
          obs.position[2] += obs.speed;
          return Math.abs(obs.position[2]) <= 20;
        });

        if (Math.random() < 0.05) {
          spawnObstacle(game);
        }
      }

      io.to(roomId).emit("game_state", {
        players: Object.values(game.players),
        obstacles: game.obstacles,
        status: game.status,
        startedAtMs: game.startedAtMs,
        roundIndex: game.roundIndex,
        roundPhase: game.roundPhase,
        phaseStartTimeMs: game.phaseStartTimeMs,
        phaseDurationMs: game.phaseDurationMs,
        obstaclesEnabled: game.obstaclesEnabled,
        nextActiveStartTimeMs: game.nextActiveStartTimeMs,
      });
    }
  };

  setInterval(async () => {
    const updatedStocks = await tickStocksAndReturnSorted();
    io.emit("stocks_updated", updatedStocks);
  }, 10000);

  setInterval(async () => {
    try {
      await runTreasuryDailySettlement();
      await runLoanDelinquencySweep();
    } catch (error) {
      console.error("Treasury/loan settlement failed", error);
    }
  }, 60_000);

  async function ensureSocketLegacyCharacter(params: { username?: string; sessionToken?: string }) {
    const username = params.username?.trim();
    if (!username) return null;

    let profileWallet: number | undefined;
    let profileName: string | undefined;
    let profileAvatar: string | undefined;
    let profileDescription: string | null | undefined;
    let profileAppearanceColor: string | undefined;
    let profileArenaMaxRounds: number | undefined;
    let profileExperience: number | undefined;

    if (params.sessionToken) {
      try {
        const me = await strapiMe(params.sessionToken);
        const profile = await getPlayerProfile(params.sessionToken, me.id);
        if (profile) {
          profileWallet = profile.wallet;
          profileName = profile.displayName ?? me.username;
          profileAvatar = profile.avatar ?? "bunny";
          profileDescription = profile.description ?? null;
          profileAppearanceColor = profile.appearanceColor ?? "#BD00FF";
          profileArenaMaxRounds = profile.arenaMaxRounds ?? 0;
          profileExperience = profile.experience ?? 0;
        }
      } catch {
        // ignore Strapi lookup errors; fallback to legacy-only flow
      }
    }

    return upsertLegacyCharacterForUsername(username, {
      wallet: profileWallet,
      name: profileName,
      avatar: profileAvatar,
      description: profileDescription,
      appearanceColor: profileAppearanceColor,
      arenaMaxRounds: profileArenaMaxRounds,
      experience: profileExperience,
    });
  }

  io.on("connection", (socket) => {
    // Identify user via cookies for secure communication
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = cookieHeader
      ? Object.fromEntries(
          cookieHeader.split(";").map((part) => {
            const trimmed = part.trim();
            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) return [trimmed, ""];
            const key = trimmed.slice(0, eqIndex);
            const value = trimmed.slice(eqIndex + 1);
            return [key, decodeURIComponent(value)];
          }),
        )
      : {};
    const mockUser = cookies["mock_user"] || cookies["bbtown_user"];
    const sessionToken = cookies["bbtown_session"];

    const syncStrapiProfileFromLegacyForCurrentSocketUser = async () => {
      if (!mockUser || !sessionToken) return;

      try {
        const legacyCharacterId = await ensureSocketLegacyCharacter({
          username: mockUser,
          sessionToken,
        });
        if (!legacyCharacterId) return;

        const character = await getCharacterById(legacyCharacterId);
        if (!character) return;

        const me = await strapiMe(sessionToken);
        await updatePlayerProfile(sessionToken, me.id, {
          wallet: character.wallet,
          experience: character.experience,
          arenaMaxRounds: character.arenaMaxRounds,
          lastSoloArenaAt: character.lastSoloArenaAt ? character.lastSoloArenaAt.toISOString() : null,
          loanStatus: character.loanStatus,
          loanLockedUntil: character.loanLockedUntil ? character.loanLockedUntil.toISOString() : null,
        });
      } catch (error) {
        console.error("Failed to sync Strapi profile from legacy socket state", error);
      }
    };

    if (mockUser) {
      socket.join(`user:${mockUser}`);
      console.log(`Socket ${socket.id} joined room user:${mockUser}`);
      const socketsForUser =
        chatSocketsByUser.get(mockUser) ?? new Set<string>();
      socketsForUser.add(socket.id);
      chatSocketsByUser.set(mockUser, socketsForUser);
    }

    chatSubscriptionsBySocket.set(socket.id, new Set([GLOBAL_CHANNEL_KEY]));

    socket.on(
      "chat.subscribe",
      (payload: { channels?: string[]; since?: string }) => {
        const requested = Array.isArray(payload?.channels)
          ? payload.channels.slice(0, 10)
          : [];
        const subscribed: string[] = [];
        const rejected: Array<{ channel: string; reason: string }> = [];
        const set =
          chatSubscriptionsBySocket.get(socket.id) ??
          new Set<string>([GLOBAL_CHANNEL_KEY]);

        for (const channelKey of requested) {
          if (!canAccessChatChannel(mockUser, channelKey)) {
            rejected.push({ channel: channelKey, reason: "forbidden" });
            continue;
          }
          set.add(channelKey);
          subscribed.push(channelKey);
        }

        if (set.size === 0) set.add(GLOBAL_CHANNEL_KEY);
        chatSubscriptionsBySocket.set(socket.id, set);

        socket.emit("chat.subscribe.ack", { ok: true, subscribed, rejected });

        if (payload?.since) {
          const sinceMs = Number.parseInt(
            String(new Date(payload.since).getTime()),
            10,
          );
          for (const channel of Array.from(set)) {
            const history = chatMessageHistory.get(channel) ?? [];
            for (const msg of history) {
              if (
                !Number.isNaN(sinceMs) &&
                new Date(msg.sentAt).getTime() < sinceMs
              )
                continue;
              socket.emit("chat.message", msg);
            }
          }
        }
      },
    );

    socket.on("chat.unsubscribe", (payload: { channels?: string[] }) => {
      const channels = Array.isArray(payload?.channels) ? payload.channels : [];
      const set =
        chatSubscriptionsBySocket.get(socket.id) ??
        new Set<string>([GLOBAL_CHANNEL_KEY]);
      for (const channel of channels) {
        if (channel === GLOBAL_CHANNEL_KEY) continue;
        set.delete(channel);
      }
      if (set.size === 0) set.add(GLOBAL_CHANNEL_KEY);
      chatSubscriptionsBySocket.set(socket.id, set);
    });

    socket.on(
      "chat.send",
      (payload: {
        clientMessageId?: string;
        channel?: string;
        body?: string;
        mentions?: string[];
      }) => {
        const channel =
          typeof payload?.channel === "string" ? payload.channel : "";
        const body =
          typeof payload?.body === "string" ? payload.body.trim() : "";

        if (!mockUser) {
          socket.emit("chat.error", {
            code: "NOT_AUTHENTICATED",
            message: "You must be signed in to chat.",
          });
          return;
        }
        if (!canAccessChatChannel(mockUser, channel)) {
          socket.emit("chat.error", {
            code: "FORBIDDEN",
            message: "You cannot post to this channel.",
          });
          return;
        }
        if (!body) {
          socket.emit("chat.error", {
            code: "EMPTY_MESSAGE",
            message: "Message cannot be empty.",
          });
          return;
        }
        if (body.length > 500) {
          socket.emit("chat.error", {
            code: "MESSAGE_TOO_LONG",
            message: "Message cannot exceed 500 characters.",
          });
          return;
        }

        const message = {
          messageId: `m_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
          channel,
          senderUserId: mockUser,
          senderName: mockUser,
          body,
          mentions: Array.isArray(payload?.mentions) ? payload.mentions : [],
          sentAt: new Date().toISOString(),
        };

        appendChatHistory(channel, message);

        for (const entry of Array.from(chatSubscriptionsBySocket.entries())) {
          const [targetSocketId, channels] = entry;
          if (!channels.has(channel)) continue;
          io.to(targetSocketId).emit("chat.message", message);
        }

        socket.emit("chat.send.ack", {
          ok: true,
          clientMessageId: payload?.clientMessageId ?? null,
          serverMessageId: message.messageId,
          sentAt: message.sentAt,
        });
      },
    );

    socket.on("buy_stock", async ({ symbol, quantity }) => {
      if (!mockUser) return;
      try {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          socket.emit("portfolio_updated", {
            message: "Quantity must be a positive whole number",
            type: "error",
          });
          return;
        }

        const legacyCharacterId = await ensureSocketLegacyCharacter({
          username: mockUser,
          sessionToken,
        });
        if (!legacyCharacterId) return;

        const tradeResult = await buyStockForCharacter({
          characterId: legacyCharacterId,
          symbol,
          quantity,
        });

        if (!tradeResult.ok) {
          socket.emit("portfolio_updated", {
            message: `Insufficient funds to buy ${quantity} shares of ${symbol}`,
            type: "error",
          });
          return;
        }

        const cost = tradeResult.cost;

        if (sessionToken) {
          try {
            const me = await strapiMe(sessionToken);
            await updatePlayerProfile(sessionToken, me.id, { wallet: tradeResult.newWallet });
          } catch (error) {
            console.error("Failed to sync Strapi wallet after buy_stock", error);
          }
        }

        io.to(`user:${mockUser}`).emit("portfolio_updated", {
          message: `Bought ${quantity} shares of ${symbol} for $${cost.toFixed(2)}`,
          type: "success",
        });
      } catch (error) {
        console.error("Error buying stock:", error);
        socket.emit("portfolio_updated", {
          message: `Failed to buy stock`,
          type: "error",
        });
      }
    });

    socket.on("sell_stock", async ({ symbol, quantity }) => {
      if (!mockUser) return;
      try {
        if (!Number.isInteger(quantity) || quantity <= 0) {
          socket.emit("portfolio_updated", {
            message: "Quantity must be a positive whole number",
            type: "error",
          });
          return;
        }

        const legacyCharacterId = await ensureSocketLegacyCharacter({
          username: mockUser,
          sessionToken,
        });
        if (!legacyCharacterId) return;

        const tradeResult = await sellStockForCharacter({
          characterId: legacyCharacterId,
          symbol,
          quantity,
        });

        if (!tradeResult.ok) {
          socket.emit("portfolio_updated", {
            message: `Not enough shares to sell`,
            type: "error",
          });
          return;
        }

        const gain = tradeResult.gain;

        if (sessionToken) {
          try {
            const me = await strapiMe(sessionToken);
            await updatePlayerProfile(sessionToken, me.id, { wallet: tradeResult.newWallet });
          } catch (error) {
            console.error("Failed to sync Strapi wallet after sell_stock", error);
          }
        }

        io.to(`user:${mockUser}`).emit("portfolio_updated", {
          message: `Sold ${quantity} shares of ${symbol} for $${gain.toFixed(2)}`,
          type: "success",
        });
      } catch (error) {
        console.error("Error selling stock:", error);
        socket.emit("portfolio_updated", {
          message: `Failed to sell stock`,
          type: "error",
        });
      }
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });

    socket.on("buy_building", (data) => {
      // Broadcast to all clients in the town
      io.emit("building_updated", data);
    });

    socket.on("chat:history:request", (payload: ChatHistoryRequestPayload) => {
      if (!mockUser) return;
      const roomId = payload?.roomId;
      if (typeof roomId !== "string" || roomId.trim().length === 0) return;

      socket.join(roomId);
      const room = getChatRoom(roomId);
      const requestedLimit = Number.isFinite(payload?.limit)
        ? Number(payload.limit)
        : 50;
      const limit = Math.max(1, Math.min(100, requestedLimit));

      const sorted = sortChatMessages([...room.messages]);
      let filtered = sorted;
      if (payload?.beforeMessageId) {
        const beforeIndex = sorted.findIndex(
          (msg) => msg.id === payload.beforeMessageId,
        );
        filtered = beforeIndex > 0 ? sorted.slice(0, beforeIndex) : [];
      }
      const messages = filtered.slice(-limit);

      socket.emit("chat:history", {
        roomId,
        messages,
        nextBeforeMessageId: messages.length > 0 ? messages[0].id : null,
        hasMore: filtered.length > messages.length,
      });
    });

    socket.on("chat:send", (payload: ChatSendPayload) => {
      if (!mockUser) {
        emitChatAck(socket, {
          clientNonce: payload?.clientNonce ?? "unknown",
          accepted: false,
          errorCode: "NOT_AUTHORIZED",
        });
        return;
      }

      const roomId = payload?.roomId;
      const clientNonce = payload?.clientNonce;
      const rawBody = payload?.body ?? "";
      const body = rawBody.trim();

      if (typeof roomId !== "string" || roomId.trim().length === 0) {
        emitChatAck(socket, {
          clientNonce: clientNonce ?? "unknown",
          accepted: false,
          errorCode: "ROOM_NOT_FOUND",
        });
        return;
      }
      if (typeof clientNonce !== "string" || clientNonce.length === 0) {
        emitChatAck(socket, {
          clientNonce: "unknown",
          accepted: false,
          errorCode: "EMPTY_MESSAGE",
        });
        return;
      }
      if (body.length === 0) {
        emitChatAck(socket, {
          clientNonce,
          accepted: false,
          errorCode: "EMPTY_MESSAGE",
        });
        return;
      }
      if (body.length > 500) {
        emitChatAck(socket, {
          clientNonce,
          accepted: false,
          errorCode: "MESSAGE_TOO_LONG",
        });
        return;
      }

      socket.join(roomId);
      const room = getChatRoom(roomId);
      const now = Date.now();
      const prior = room.sendTimestampsByUser.get(mockUser) ?? [];
      const recent = prior.filter(
        (ts) => now - ts <= CHAT_RATE_LIMIT_WINDOW_MS,
      );
      if (recent.length >= CHAT_RATE_LIMIT_COUNT) {
        room.sendTimestampsByUser.set(mockUser, recent);
        emitChatAck(socket, {
          clientNonce,
          accepted: false,
          errorCode: "RATE_LIMIT",
        });
        return;
      }

      recent.push(now);
      room.sendTimestampsByUser.set(mockUser, recent);

      const existing = room.messages.find(
        (msg) => msg.clientNonce === clientNonce && msg.senderId === mockUser,
      );
      if (existing) {
        emitChatAck(socket, {
          clientNonce,
          messageId: existing.id,
          accepted: true,
          errorCode: null,
        });
        return;
      }

      const message: ChatMessage = {
        id: `msg_${Math.random().toString(36).slice(2, 11)}`,
        roomId,
        senderId: mockUser,
        senderName: mockUser,
        body,
        createdAtMs: now,
        clientNonce,
        kind: "user",
      };

      room.messages.push(message);
      room.messages = sortChatMessages(room.messages).slice(-CHAT_MAX_HISTORY);

      if (roomId.startsWith("whisper:")) {
        const [, userA, userB] = roomId.split(":");
        io.to(roomId).to(`user:${userA}`).to(`user:${userB}`).emit("chat:message", { message });
      } else {
        io.to(roomId).emit("chat:message", { message });
      }

      emitChatAck(socket, {
        clientNonce,
        messageId: message.id,
        accepted: true,
        errorCode: null,
      });
    });

    socket.on("chat:read:upsert", (payload: ChatReadUpsertPayload) => {
      if (!mockUser) return;
      const roomId = payload?.roomId;
      const lastReadMessageId = payload?.lastReadMessageId;
      if (typeof roomId !== "string" || roomId.trim().length === 0) return;
      if (
        typeof lastReadMessageId !== "string" ||
        lastReadMessageId.trim().length === 0
      )
        return;

      const room = getChatRoom(roomId);
      room.readStateByUser.set(mockUser, lastReadMessageId);
    });

    // Arena Matchmaking & Game Logic
    socket.on("join_arena", () => {
      if (!mockUser) return;

      // Check if already in queue
      if (matchmakingQueue.find((p) => p.username === mockUser)) {
        return;
      }

      matchmakingQueue.push({ socketId: socket.id, username: mockUser });
      console.log(
        `User ${mockUser} joined arena queue. Queue size: ${matchmakingQueue.length}`,
      );

      if (matchmakingQueue.length >= 2) {
        const player1 = matchmakingQueue.shift()!;
        const player2 = matchmakingQueue.shift()!;
        const gameRoomId = `game-${Math.random().toString(36).substring(2, 9)}`;

        // Initialize game session
        games[gameRoomId] = {
          roomId: gameRoomId,
          players: {},
          obstacles: [],
          status: "waiting",
          timer: 0,
          nextSpawnSequence: 1,
        };

        console.log(
          `Match found! ${player1.username} vs ${player2.username}. Room: ${gameRoomId}`,
        );

        io.to(player1.socketId).emit("match_found", { gameRoomId });
        io.to(player2.socketId).emit("match_found", { gameRoomId });
      }
    });

    socket.on("join_singleplayer_arena", () => {
      if (!mockUser) return;
      const gameRoomId = `solo-${Math.random().toString(36).substring(2, 9)}`;

      games[gameRoomId] = {
        roomId: gameRoomId,
        players: {},
        obstacles: [],
        status: "waiting",
        timer: 0,
        nextSpawnSequence: 1,
      };

      console.log(
        `Singleplayer arena created for ${mockUser}. Room: ${gameRoomId}`,
      );
      socket.emit("match_found", { gameRoomId });
    });

    socket.on("leave_arena", () => {
      const index = matchmakingQueue.findIndex((p) => p.socketId === socket.id);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        console.log(
          `User ${mockUser} left arena queue. Queue size: ${matchmakingQueue.length}`,
        );
      }
    });

    socket.on("join_arena_room", async (payload: JoinArenaRoomPayload) => {
      if (!mockUser) return;

      const roomId = payload?.roomId;
      if (typeof roomId !== "string" || roomId.length === 0) return;

      // Auto-create room if it's a test room
      if (!games[roomId] && roomId.includes("test")) {
        games[roomId] = {
          roomId,
          players: {},
          obstacles: [],
          status: "waiting",
          timer: 0,
          nextSpawnSequence: 1,
        };
      }

      if (!games[roomId]) return;

      socket.join(roomId);
      const game = games[roomId];
      const playerCount = Object.keys(game.players).length;
      const sequence = game.nextSpawnSequence++;
      const isSolo = roomId.startsWith("solo-");

      let avatar = "bunny";
      const legacyCharacterId = await ensureSocketLegacyCharacter({
        username: mockUser,
        sessionToken,
      });

      if (legacyCharacterId) {
        const character = await getCharacterById(legacyCharacterId);
        avatar = character?.avatar ?? "bunny";
      } else {
        avatar = await getAvatarForUsername(mockUser);
      }

      game.players[socket.id] = buildSpawnPlayerState(
        socket.id,
        mockUser,
        playerCount,
        "initial_join",
        payload?.cameraYaw,
        sequence,
        avatar,
      );

      console.log(
        `User ${mockUser} joined arena room ${roomId}. Players: ${Object.keys(game.players).length}`,
      );

      if (isSolo || Object.keys(games[roomId].players).length === 2) {
        games[roomId].status = "playing";
        games[roomId].startedAtMs = Date.now();
        const phaseState = getRoundPhaseStateAt(
          games[roomId].startedAtMs,
          games[roomId].startedAtMs,
          DEFAULT_ROUND_TRANSITION_CONFIG,
        );
        games[roomId].roundIndex = phaseState.roundIndex;
        games[roomId].roundPhase = phaseState.phase;
        games[roomId].phaseStartTimeMs = phaseState.phaseStartTimeMs;
        games[roomId].phaseDurationMs = phaseState.phaseDurationMs;
        games[roomId].obstaclesEnabled = phaseState.obstaclesEnabled;
        console.log(`Game ${roomId} starting!`);

        const intervalId = setInterval(() => updateGame(roomId), 1000 / 30);
        games[roomId].intervalId = intervalId;

        io.to(roomId).emit("game_start", {
          players: Object.values(games[roomId].players),
          startedAtMs: games[roomId].startedAtMs,
          roundIndex: games[roomId].roundIndex,
          roundPhase: games[roomId].roundPhase,
          phaseStartTimeMs: games[roomId].phaseStartTimeMs,
          phaseDurationMs: games[roomId].phaseDurationMs,
          obstaclesEnabled: games[roomId].obstaclesEnabled,
          nextActiveStartTimeMs: games[roomId].nextActiveStartTimeMs,
        });
      }
    });

    socket.on("player_move", ({ roomId, position, rotation, anim }) => {
      if (games[roomId] && games[roomId].players[socket.id]) {
        games[roomId].players[socket.id].position = position;
        games[roomId].players[socket.id].rotation = rotation;
        games[roomId].players[socket.id].anim = anim || "Idle_1"; // <-- NEU: Im State speichern
      }
    });

    socket.on("player_fell", async ({ roomId }) => {
      if (
        games[roomId] &&
        games[roomId].players[socket.id] &&
        games[roomId].status === "playing"
      ) {
        console.log(`Player ${mockUser} fell off in room ${roomId}`);
        games[roomId].status = "finished";
        const loser = mockUser;
        const game = games[roomId];
        const winnerPlayer = Object.values(game.players).find(
          (p) => p.id !== socket.id,
        );
        const winner = winnerPlayer?.username;
        const isSolo = roomId.startsWith("solo-");
        const reward = isSolo ? 0 : 1000;
        const endedAt = Date.now();
        const elapsedSeconds = Math.max(
          0,
          (endedAt - (game.startedAtMs ?? endedAt)) / 1000,
        );
        const roundsReached = Math.max(
          0,
          Math.min(
            TOTAL_ROUNDS,
            Math.floor(elapsedSeconds / ROUND_DURATION_SECONDS) + 1,
          ),
        );

        const toplistPayload: PostMatchEntry[] = Object.values(
          game.players,
        ).map((player) => {
          const fell = player.id === socket.id;
          return {
            playerId: player.id,
            displayName: player.username,
            roundsReached,
            eliminationOrder: fell ? 1 : null,
            eliminatedAtMs: fell ? endedAt : null,
          };
        });

        try {
          if (!isSolo) {
            setGlobalToplist(toplistPayload);
          }

          await applyArenaResult({
            winner,
            loser,
            reward,
            isSolo,
            roundsReached,
          });

          await syncStrapiProfileFromLegacyForCurrentSocketUser();
        } catch (error) {
          console.error("Failed to finalize arena results:", error);
        }

        io.to(roomId).emit("game_over", {
          winner: isSolo ? undefined : winner,
          loser,
          reward,
          mode: isSolo ? "SP" : "MP",
          endedAt,
          roundsReached,
          entries: toplistPayload,
        });

        if (games[roomId].intervalId) {
          clearInterval(games[roomId].intervalId);
        }

        // Keep game session for a bit so clients can show results
        setTimeout(() => {
          delete games[roomId];
        }, 10000);
      }
    });

    socket.on("disconnect", () => {
      chatSubscriptionsBySocket.delete(socket.id);
      if (mockUser) {
        const socketsForUser = chatSocketsByUser.get(mockUser);
        if (socketsForUser) {
          socketsForUser.delete(socket.id);
          if (socketsForUser.size === 0) {
            chatSocketsByUser.delete(mockUser);
          }
        }
      }
      const index = matchmakingQueue.findIndex((p) => p.socketId === socket.id);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
      }

      // Cleanup games
      for (const roomId in games) {
        if (games[roomId].players[socket.id]) {
          console.log(`Player ${socket.id} left game ${roomId}. Cleaning up.`);
          if (games[roomId].intervalId) {
            clearInterval(games[roomId].intervalId);
          }
          delete games[roomId];
          io.to(roomId).emit("opponent_left");
        }
      }
    });
  });

  server.get("/api/health", (req, res) => {
    res.send("OK");
  });

  server.all("*", (req: any, res: any) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
