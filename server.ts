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

  // Stock update interval
  setInterval(async () => {
    const stocks = await prisma.stock.findMany();
    for (const stock of stocks) {
      // Random movement between -5% and +5%
      const changePercent = (Math.random() * 0.1) - 0.05;
      const newPrice = Math.max(0.01, stock.price * (1 + changePercent));
      
      await prisma.stock.update({
        where: { id: stock.id },
        data: {
          previousPrice: stock.price,
          price: newPrice
        }
      });
    }
    const updatedStocks = await prisma.stock.findMany({
      orderBy: { symbol: 'asc' }
    });
    io.emit("stocks_updated", updatedStocks);
  }, 10000);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });

    socket.on("buy_building", (data) => {
      // Broadcast to all clients in the town
      io.emit("building_updated", data);
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
