import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3004", 10);

const prisma = new PrismaClient();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize funny stocks
  const FUNNY_STOCKS = [
    { symbol: 'BANA', name: 'Banana Stand', price: 10.0 },
    { symbol: 'STONK', name: 'Stonks R Us', price: 69.0 },
    { symbol: 'DOGE', name: 'Doge Much Wow', price: 4.2 },
    { symbol: 'TEAR', name: 'Unicorn Tears', price: 100.0 },
    { symbol: 'COPE', name: 'Copium Corp', price: 50.0 },
  ];

  for (const stock of FUNNY_STOCKS) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {},
      create: {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        previousPrice: stock.price
      }
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
  }

  interface Obstacle {
    id: string;
    type: 'beam';
    position: [number, number, number];
    speed: number;
    width: number;
  }

  interface GameSession {
    roomId: string;
    players: Record<string, PlayerState>;
    obstacles: Obstacle[];
    status: 'waiting' | 'playing' | 'finished';
    timer: number;
    intervalId?: NodeJS.Timeout;
  }

  const games: Record<string, GameSession> = {};

  const spawnObstacle = (game: GameSession) => {
    const id = `obs-${Math.random().toString(36).substring(2, 7)}`;
    // Spawn at z = -15 or 15 and move across
    const side = Math.random() > 0.5 ? 1 : -1;
    const obstacle: Obstacle = {
      id,
      type: 'beam',
      position: [0, 0.5, side * 15],
      speed: side * -0.1, // Move towards center
      width: 10
    };
    game.obstacles.push(obstacle);
  };

  const updateGame = (roomId: string) => {
    const game = games[roomId];
    if (!game || game.status !== 'playing') return;

    // Update obstacles
    game.obstacles = game.obstacles.filter(obs => {
      obs.position[2] += obs.speed;
      return Math.abs(obs.position[2]) <= 20;
    });

    // Randomly spawn obstacles
    if (Math.random() < 0.05) {
      spawnObstacle(game);
    }

    io.to(roomId).emit("game_state", {
      players: Object.values(game.players),
      obstacles: game.obstacles,
      status: game.status
    });
  };

  // Stock update interval
  setInterval(async () => {
    const stocks = await prisma.stock.findMany();
    for (const stock of stocks) {
      // Random movement between -5% and +5%
      const changePercent = (Math.random() * 0.1) - 0.05;
      const newPrice = Math.max(0.01, stock.price * (1 + changePercent));
      
      await prisma.$transaction([
        prisma.stock.update({
          where: { id: stock.id },
          data: {
            previousPrice: stock.price,
            price: newPrice
          }
        }),
        prisma.stockHistory.create({
          data: {
            stockId: stock.id,
            price: newPrice
          }
        })
      ]);
    }
    const updatedStocks = await prisma.stock.findMany({
      orderBy: { symbol: 'asc' }
    });
    io.emit("stocks_updated", updatedStocks);
  }, 10000);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Identify user via cookies for secure communication
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split('; ').map(c => c.split('='))) : {};
    const mockUser = cookies['mock_user'];

    if (mockUser) {
      socket.join(`user:${mockUser}`);
      console.log(`Socket ${socket.id} joined room user:${mockUser}`);
    }

    socket.on("buy_stock", async ({ symbol, quantity }) => {
      if (!mockUser) return;
      try {
        const user = await prisma.user.findUnique({
          where: { username: mockUser },
          include: { character: true }
        });
        if (!user || !user.character) return;

        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock) return;

        const cost = stock.price * quantity;
        if (user.character.wallet < cost) {
          socket.emit("portfolio_updated", {
            message: `Insufficient funds to buy ${quantity} shares of ${symbol}`,
            type: "error"
          });
          return;
        }

        await prisma.$transaction([
          prisma.character.update({
            where: { id: user.character.id },
            data: { wallet: { decrement: cost } }
          }),
          prisma.portfolioItem.upsert({
            where: {
              characterId_stockId: {
                characterId: user.character.id,
                stockId: stock.id
              }
            },
            create: {
              characterId: user.character.id,
              stockId: stock.id,
              quantity
            },
            update: {
              quantity: { increment: quantity }
            }
          })
        ]);

        io.to(`user:${mockUser}`).emit("portfolio_updated", {
          message: `Bought ${quantity} shares of ${symbol} for $${cost.toFixed(2)}`,
          type: "success"
        });
      } catch (error) {
        console.error("Error buying stock:", error);
        socket.emit("portfolio_updated", {
          message: `Failed to buy stock`,
          type: "error"
        });
      }
    });

    socket.on("sell_stock", async ({ symbol, quantity }) => {
      if (!mockUser) return;
      try {
        const user = await prisma.user.findUnique({
          where: { username: mockUser },
          include: { character: true }
        });
        if (!user || !user.character) return;

        const stock = await prisma.stock.findUnique({ where: { symbol } });
        if (!stock) return;

        const portfolioItem = await prisma.portfolioItem.findUnique({
          where: {
            characterId_stockId: {
              characterId: user.character.id,
              stockId: stock.id
            }
          }
        });

        if (!portfolioItem || portfolioItem.quantity < quantity) {
          socket.emit("portfolio_updated", {
            message: `Not enough shares to sell`,
            type: "error"
          });
          return;
        }

        const gain = stock.price * quantity;

        await prisma.$transaction([
          prisma.character.update({
            where: { id: user.character.id },
            data: { wallet: { increment: gain } }
          }),
          prisma.portfolioItem.update({
            where: { id: portfolioItem.id },
            data: { quantity: { decrement: quantity } }
          })
        ]);

        io.to(`user:${mockUser}`).emit("portfolio_updated", {
          message: `Sold ${quantity} shares of ${symbol} for $${gain.toFixed(2)}`,
          type: "success"
        });
      } catch (error) {
        console.error("Error selling stock:", error);
        socket.emit("portfolio_updated", {
          message: `Failed to sell stock`,
          type: "error"
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
      if (matchmakingQueue.find(p => p.username === mockUser)) {
        return;
      }

      matchmakingQueue.push({ socketId: socket.id, username: mockUser });
      console.log(`User ${mockUser} joined arena queue. Queue size: ${matchmakingQueue.length}`);

      if (matchmakingQueue.length >= 2) {
        const player1 = matchmakingQueue.shift()!;
        const player2 = matchmakingQueue.shift()!;
        const gameRoomId = `game-${Math.random().toString(36).substring(2, 9)}`;

        // Initialize game session
        games[gameRoomId] = {
          roomId: gameRoomId,
          players: {},
          obstacles: [],
          status: 'waiting',
          timer: 0
        };

        console.log(`Match found! ${player1.username} vs ${player2.username}. Room: ${gameRoomId}`);

        io.to(player1.socketId).emit("match_found", { gameRoomId });
        io.to(player2.socketId).emit("match_found", { gameRoomId });
      }
    });

    socket.on("leave_arena", () => {
      const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        console.log(`User ${mockUser} left arena queue. Queue size: ${matchmakingQueue.length}`);
      }
    });

    socket.on("join_arena_room", ({ roomId }) => {
      if (!mockUser) return;

      // Auto-create room if it's a test room
      if (!games[roomId] && roomId.includes("test")) {
        games[roomId] = {
          roomId,
          players: {},
          obstacles: [],
          status: 'waiting',
          timer: 0
        };
      }

      if (!games[roomId]) return;

      socket.join(roomId);
      const playerCount = Object.keys(games[roomId].players).length;
      games[roomId].players[socket.id] = {
        id: socket.id,
        username: mockUser,
        position: [playerCount === 0 ? -2 : 2, 0, 0],
        rotation: 0
      };

      console.log(`User ${mockUser} joined arena room ${roomId}. Players: ${Object.keys(games[roomId].players).length}`);

      if (Object.keys(games[roomId].players).length === 2) {
        games[roomId].status = 'playing';
        console.log(`Game ${roomId} starting!`);

        const intervalId = setInterval(() => updateGame(roomId), 1000 / 30);
        games[roomId].intervalId = intervalId;

        io.to(roomId).emit("game_start", {
          players: Object.values(games[roomId].players)
        });
      }
    });

    socket.on("player_move", ({ roomId, position, rotation }) => {
      if (games[roomId] && games[roomId].players[socket.id]) {
        games[roomId].players[socket.id].position = position;
        games[roomId].players[socket.id].rotation = rotation;
      }
    });

    socket.on("player_fell", ({ roomId }) => {
      if (games[roomId] && games[roomId].players[socket.id] && games[roomId].status === 'playing') {
        console.log(`Player ${mockUser} fell off in room ${roomId}`);
        games[roomId].status = 'finished';
        const loser = mockUser;
        const winner = Object.values(games[roomId].players).find(p => p.id !== socket.id)?.username;

        io.to(roomId).emit("game_over", {
          winner,
          loser
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
      const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
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
