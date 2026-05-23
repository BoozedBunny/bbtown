-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "appearanceColor" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT 'bunny',
    "wallet" INTEGER NOT NULL DEFAULT 1000,
    "loanStatus" TEXT NOT NULL DEFAULT 'NONE',
    "loanLockedUntil" DATETIME,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("appearanceColor", "id", "loanLockedUntil", "loanStatus", "name", "userId", "wallet") SELECT "appearanceColor", "id", "loanLockedUntil", "loanStatus", "name", "userId", "wallet" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
