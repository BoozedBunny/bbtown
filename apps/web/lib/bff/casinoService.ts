import { oneOrNull, withTransaction } from "@/lib/db";

export async function runLegacyCasinoSpin(characterId: string, betAmount: number, totalWin: number) {
  return withTransaction(async (tx) => {
    const character = await oneOrNull<{ wallet: number }>(
      'SELECT "wallet" FROM "Character" WHERE "id" = $1 LIMIT 1',
      [characterId],
      tx,
    );

    if (!character) throw new Error("Character not found");
    if (character.wallet < betAmount) throw new Error("Insufficient funds");

    await tx.query('UPDATE "Character" SET "wallet" = "wallet" - $2 WHERE "id" = $1', [characterId, betAmount]);

    let finalWallet = character.wallet - betAmount;
    if (totalWin > 0) {
      const updated = await oneOrNull<{ wallet: number }>(
        'UPDATE "Character" SET "wallet" = "wallet" + $2 WHERE "id" = $1 RETURNING "wallet"',
        [characterId, totalWin],
        tx,
      );
      finalWallet = updated?.wallet ?? finalWallet;
    }

    return finalWallet;
  });
}
