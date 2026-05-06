import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { COMPANY_PROFILES } from "./lib/market/companyProfiles";
import { runTreasuryDailySettlement } from "./lib/treasury/treasuryService";
import { runLoanDelinquencySweep } from "./lib/treasury/loanService";
import { PostMatchEntry, setGlobalToplist } from "./lib/arena/toplist";
import { DEFAULT_ROUND_TRANSITION_CONFIG, getRoundPhaseStateAt } from "./lib/arena/roundPhases";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3004", 10);

const ROUND_DURATION_SECONDS = 30;
const TOTAL_ROUNDS = 30;

const prisma = new PrismaClient();

type SqliteTableInfoRow = {
  name: string;
};

async function getCharacterColumns(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<SqliteTableInfoRow[]>("PRAGMA table_info('Character')");
  return new Set(rows.map((row) => row.name));
}

async function ensureCharacterLoanSchemaReady() {
  const requiredColumns = ["loanStatus", "loanLockedUntil"] as const;
  const existingColumns = await getCharacterColumns();
  const missingColumns = requiredColumns.filter((column) => !existingColumns.has(column));

  if (missingColumns.length === 0) return;

  console.warn(
    `[SchemaGuard] Character table missing columns (${missingColumns.join(", ")}). Running one-time prisma db push to repair schema drift.`,
  );

  execSync("npx prisma db push", { stdio: "inherit" });

  const postPushColumns = await getCharacterColumns();
  const stillMissing = requiredColumns.filter((column) => !postPushColumns.has(column));
  if (stillMissing.length > 0) {
    throw new Error(`[SchemaGuard] Prisma schema sync failed. Still missing Character columns: ${stillMissing.join(", ")}`);
  }

  console.log("[SchemaGuard] Character loan columns restored successfully.");
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await ensureCharacterLoanSchemaReady();

  // Initialize exchange company universe from shared profile config.
  for (const stock of COMPANY_PROFILES) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.basePrice,
        previousPrice: stock.basePrice,
      },
    });
  }

  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  // Arena Matchmaking Queue
  const matchmakingQueue: { socketId: string; username: string }[] = [];

  interface PlayerState {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    anim: string;
    spawnReason: "initial_join" | "respawn" | "landing_reset" | "zone_transfer";
    spawnSequence: number;
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
    intervalId?: NodeJS.Timeout;
    nextSpawnSequence: number;
  }

  const games: Record<string, GameSession> = {};
  const spawnOrientationAwayFromCameraEnabled =
    process.env.SPAWN_ORIENTATION_AWAY_FROM_CAMERA !== "0";
  const spawnSlotAllocatorEnabled = process.env.SPAWN_MP_SLOT_ALLOCATOR_V1 !== "0";
  const spawnSpacing = Number.parseFloat(process.env.SPAWN_MP_SPACING_METERS ?? "1.5");

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

  const computeSpawnPosition = (slotIndex: number): [number, number, number] => {
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
    if (!game || game.status !== "playing") return;

    const nowMs = Date.now();
    const startedAtMs = game.startedAtMs ?? nowMs;
    const phaseState = getRoundPhaseStateAt(nowMs, startedAtMs, DEFAULT_ROUND_TRANSITION_CONFIG);
    game.roundIndex = phaseState.roundIndex;
    game.roundPhase = phaseState.phase;
    game.phaseStartTimeMs = phaseState.phaseStartTimeMs;
    game.phaseDurationMs = phaseState.phaseDurationMs;
    game.obstaclesEnabled = phaseState.obstaclesEnabled;

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
    });
  };

  // Stock update interval
  setInterval(async () => {
    const stocks = await prisma.stock.findMany();
    for (const stock of stocks) {
      // Random movement between -5% and +5%
      const changePercent = Math.random() * 0.1 - 0.05;
      const newPrice = Math.max(0.01, stock.price * (1 + changePercent));

      await prisma.$transaction([
        prisma.stock.update({
          where: { id: stock.id },
          data: {
            previousPrice: stock.price,
            price: newPrice,
          },
        }),
        prisma.stockHistory.create({
          data: {
            stockId: stock.id,
            price: newPrice,
          },
        }),
      ]);
    }
    const updatedStocks = await prisma.stock.findMany({
      orderBy: { symbol: "asc" },
    });
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

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Identify user via cookies for secure communication
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = cookieHeader
      ? Object.fromEntries(cookieHeader.split("; ").map((c) => c.split("=")))
      : {};
    const mockUser = cookies["mock_user"];

    if (mockUser) {
      socket.join(`user:${mockUser}`);
      console.log(`Socket ${socket.id} joined room user:${mockUser}`);
    }

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

        const user = await prisma.user.findUnique({
          where: { username: mockUser },
          include: { character: true },
        });
        if (!user || !user.character) return;

        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock) return;

        const cost = stock.price * quantity;
        if (user.character.wallet < cost) {
          socket.emit("portfolio_updated", {
            message: `Insufficient funds to buy ${quantity} shares of ${symbol}`,
            type: "error",
          });
          return;
        }

        await prisma.$transaction([
          prisma.character.update({
            where: { id: user.character.id },
            data: { wallet: { decrement: cost } },
          }),
          prisma.portfolioItem.upsert({
            where: {
              characterId_stockId: {
                characterId: user.character.id,
                stockId: stock.id,
              },
            },
            create: {
              characterId: user.character.id,
              stockId: stock.id,
              quantity,
            },
            update: {
              quantity: { increment: quantity },
            },
          }),
        ]);

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

        const user = await prisma.user.findUnique({
          where: { username: mockUser },
          include: { character: true },
        });
        if (!user || !user.character) return;

        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock) return;

        const portfolioItem = await prisma.portfolioItem.findUnique({
          where: {
            characterId_stockId: {
              characterId: user.character.id,
              stockId: stock.id,
            },
          },
        });

        if (!portfolioItem || portfolioItem.quantity < quantity) {
          socket.emit("portfolio_updated", {
            message: `Not enough shares to sell`,
            type: "error",
          });
          return;
        }

        const gain = stock.price * quantity;

        await prisma.$transaction([
          prisma.character.update({
            where: { id: user.character.id },
            data: { wallet: { increment: gain } },
          }),
          prisma.portfolioItem.update({
            where: { id: portfolioItem.id },
            data: { quantity: { decrement: quantity } },
          }),
        ]);

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

    socket.on("join_arena_room", (payload: JoinArenaRoomPayload) => {
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

      game.players[socket.id] = buildSpawnPlayerState(
        socket.id,
        mockUser,
        playerCount,
        "initial_join",
        payload?.cameraYaw,
        sequence,
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
        const winnerPlayer = Object.values(game.players).find((p) => p.id !== socket.id);
        const winner = winnerPlayer?.username;
        const isSolo = roomId.startsWith("solo-");
        const reward = isSolo ? 0 : 1000;
        const endedAt = Date.now();
        const elapsedSeconds = Math.max(0, (endedAt - (game.startedAtMs ?? endedAt)) / 1000);
        const roundsReached = Math.max(
          0,
          Math.min(TOTAL_ROUNDS, Math.floor(elapsedSeconds / ROUND_DURATION_SECONDS) + 1),
        );

        const toplistPayload: PostMatchEntry[] = Object.values(game.players).map((player) => {
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

          if (winner && !isSolo) {
            await prisma.character.updateMany({
              where: { user: { username: winner } },
              data: { wallet: { increment: reward } },
            });
            console.log(`Granted ${reward} reward to winner: ${winner}`);
          }
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
      console.log("User disconnected:", socket.id);
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
