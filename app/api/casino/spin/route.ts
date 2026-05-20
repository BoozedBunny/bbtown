import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYMBOLS = ["Cherry", "Lemon", "Bell", "Seven", "Diamond"];
const WEIGHTS = [40, 30, 15, 10, 5];

const PAY_TABLE: Record<string, number> = {
  Cherry: 2,
  Lemon: 5,
  Bell: 10,
  Seven: 25,
  Diamond: 100,
};

function getRandomSymbol() {
  const totalWeight = WEIGHTS.reduce((sum, w) => sum + w, 0);
  let random = Math.floor(Math.random() * totalWeight);
  for (let i = 0; i < SYMBOLS.length; i++) {
    if (random < WEIGHTS[i]) {
      return SYMBOLS[i];
    }
    random -= WEIGHTS[i];
  }
  return SYMBOLS[0];
}

function generateMatrix(rows: number, cols: number) {
  const matrix: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(getRandomSymbol());
    }
    matrix.push(row);
  }
  return matrix;
}

// 5 columns x 3 rows grid
// Coordinates are [row][col]
const PAYLINES = [
  // 3 Horizontal lines
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  // 2 Zig-Zags
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
  [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]],
  // 2 V-shapes
  [[0, 0], [1, 0], [2, 1], [1, 2], [0, 2]], // This is not 5 long, replacing with better paylines below
  [[0, 0], [1, 1], [2, 0], [1, 1], [0, 0]],
];

// Valid 5-length paylines
const VALID_PAYLINES = [
  // 3 Horizontal
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  // 2 Zig-zag (V and inverted V)
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
  [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]],
  // 2 M / W shapes
  [[2, 0], [0, 1], [2, 2], [0, 3], [2, 4]],
  [[0, 0], [2, 1], [0, 2], [2, 3], [0, 4]],
  // 2 Trapeze shapes
  [[0, 0], [0, 1], [1, 2], [2, 3], [2, 4]],
  [[2, 0], [2, 1], [1, 2], [0, 3], [0, 4]],
  // 1 Middle peak
  [[1, 0], [0, 1], [0, 2], [0, 3], [1, 4]],
];

function evaluatePaylines(matrix: string[][], betAmount: number) {
  let totalWin = 0;
  const winningLines: { lineIndex: number; symbol: string; count: number; win: number }[] = [];

  VALID_PAYLINES.forEach((line, index) => {
    // Collect symbols along the payline strictly from left to right
    const symbols = line.map(([r, c]) => matrix[r][c]);

    // Find consecutive identical symbols starting from the first reel
    const firstSymbol = symbols[0];
    let count = 1;
    for (let i = 1; i < symbols.length; i++) {
      if (symbols[i] === firstSymbol) {
        count++;
      } else {
        break;
      }
    }

    // A win requires at least 3 identical symbols from left to right
    if (count >= 3) {
      // Multiplier based on the number of matches (e.g. 3 matches = 1x base, 4 = 2x, 5 = 5x)
      const lengthMultiplier = count === 3 ? 1 : count === 4 ? 2 : 5;
      const baseWin = PAY_TABLE[firstSymbol] || 0;

      // Calculate win relative to the betAmount.
      // The PAY_TABLE represents a multiplier per unit bet. Let's define the base bet per line as betAmount / 10 lines.
      // E.g. bet 100 on 10 lines = 10 per line.
      const betPerLine = betAmount / VALID_PAYLINES.length;

      const lineWin = Math.floor(betPerLine * baseWin * lengthMultiplier);

      if (lineWin > 0) {
        totalWin += lineWin;
        winningLines.push({ lineIndex: index, symbol: firstSymbol, count, win: lineWin });
      }
    }
  });

  return { totalWin, winningLines };
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !user.character) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const betAmount = parseInt(body.betAmount, 10);

    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: "Invalid bet amount" }, { status: 400 });
    }

    // We need to use interactive transaction to safely deduct the bet and update the balance
    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: user.character!.id },
        select: { wallet: true },
      });

      if (!character) {
        throw new Error("Character not found");
      }

      if (character.wallet < betAmount) {
        throw new Error("Insufficient funds");
      }

      // Deduct the bet amount immediately
      await tx.character.update({
        where: { id: user.character!.id },
        data: { wallet: { decrement: betAmount } },
      });

      // Generate the 5x3 matrix
      // Returns rows x cols. We want 3 rows, 5 columns.
      const matrix = generateMatrix(3, 5);

      // Calculate winnings
      const { totalWin, winningLines } = evaluatePaylines(matrix, betAmount);

      // Add winnings if any
      let finalWallet = character.wallet - betAmount;
      if (totalWin > 0) {
        const updatedChar = await tx.character.update({
          where: { id: user.character!.id },
          data: { wallet: { increment: totalWin } },
        });
        finalWallet = updatedChar.wallet;
      }

      return {
        matrix,
        winAmount: totalWin,
        newBalance: finalWallet,
        winningLines,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "Insufficient funds") {
      return NextResponse.json({ error: "Insufficient funds" }, { status: 400 });
    }
    console.error("Casino spin error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
