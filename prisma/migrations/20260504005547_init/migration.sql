-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "appearanceColor" TEXT NOT NULL,
    "wallet" INTEGER NOT NULL DEFAULT 1000,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "townId" TEXT NOT NULL,
    "title" TEXT,
    "forSale" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER NOT NULL DEFAULT 5000,
    "employees" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    CONSTRAINT "BuildingState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Town" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "bankBalance" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GameState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 100.0,
    "previousPrice" REAL NOT NULL DEFAULT 100.0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockHistory_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PortfolioItem_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PortfolioItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_symbol_key" ON "Stock"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_characterId_stockId_key" ON "PortfolioItem"("characterId", "stockId");
