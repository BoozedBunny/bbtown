import { prisma } from "@/lib/prisma";

export async function runLegacyCasinoSpin(characterId: string, betAmount: number, totalWin: number) {
  return prisma.$transaction(async (tx) => {
    const character = await tx.character.findUnique({
      where: { id: characterId },
      select: { wallet: true },
    });

    if (!character) throw new Error("Character not found");
    if (character.wallet < betAmount) throw new Error("Insufficient funds");

    await tx.character.update({
      where: { id: characterId },
      data: { wallet: { decrement: betAmount } },
    });

    let finalWallet = character.wallet - betAmount;
    if (totalWin > 0) {
      const updatedChar = await tx.character.update({
        where: { id: characterId },
        data: { wallet: { increment: totalWin } },
      });
      finalWallet = updatedChar.wallet;
    }

    return finalWallet;
  });
}
