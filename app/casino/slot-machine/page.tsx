"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/app/actions/user";
import { Cherry, Citrus, Bell, Gem, Diamond, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const SYMBOL_MAP: Record<string, React.ReactNode> = {
  Cherry: <Cherry className="w-12 h-12 text-red-500" />,
  Lemon: <Citrus className="w-12 h-12 text-yellow-400" />,
  Bell: <Bell className="w-12 h-12 text-amber-500" />,
  Seven: <span className="text-5xl font-black text-red-600">7</span>,
  Diamond: <Diamond className="w-12 h-12 text-cyan-400" />,
};

type WinningLine = {
  lineIndex: number;
  symbol: string;
  count: number;
  win: number;
};

export default function SlotMachine() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [matrix, setMatrix] = useState<string[][]>([
    ["Cherry", "Lemon", "Bell", "Seven", "Diamond"],
    ["Diamond", "Seven", "Bell", "Lemon", "Cherry"],
    ["Cherry", "Lemon", "Bell", "Seven", "Diamond"],
  ]);
  const [lastWin, setLastWin] = useState<number>(0);
  const [winningLines, setWinningLines] = useState<WinningLine[]>([]);

  // Spin columns visually
  const [spinCols, setSpinCols] = useState<boolean[]>([false, false, false, false, false]);

  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setBalance(user.character.wallet);
    }
    loadUser();
  }, [router]);

  const handleSpin = async () => {
    if (isSpinning) return;
    if (balance < betAmount) {
      toast.error("Insufficient funds!");
      return;
    }

    setIsSpinning(true);
    setLastWin(0);
    setWinningLines([]);
    setBalance((prev) => prev - betAmount);
    setSpinCols([true, true, true, true, true]);

    try {
      const response = await fetch("/api/casino/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to spin");
      }

      // Load data immediately to display correct symbol when columns stop
      setMatrix(data.matrix);
      setLastWin(data.winAmount);
      setBalance(data.newBalance);
      setWinningLines(data.winningLines);

      // Stop spinning column by column
      for (let c = 0; c < 5; c++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSpinCols((prev) => {
          const next = [...prev];
          next[c] = false;
          return next;
        });
      }

      if (data.winAmount > 0) {
        toast.success(`You won ${data.winAmount} coins!`);
      }
    } catch (error: any) {
      toast.error(error.message);
      setBalance((prev) => prev + betAmount); // Refund visually
      setSpinCols([false, false, false, false, false]);
    } finally {
      setIsSpinning(false);
    }
  };

  const isWinningCell = (r: number, c: number) => {
    // A cell is part of a win if its coordinates are in any of the winning lines
    // We would need to pass exact winning line coordinates from backend, but since we didn't,
    // we can roughly identify if this column index < count for the winning symbol.
    // However, since we want pulsing effects, let's just pulse the entire board if there's a win, or check if the symbol matches a winning line symbol.
    for (const line of winningLines) {
      if (matrix[r][c] === line.symbol && c < line.count) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl relative cyber-panel p-8 rounded-3xl border-brand-primary/50 shadow-[0_0_50px_rgba(189,0,255,0.15)]">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/town/1">
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Town
            </Button>
          </Link>
          <div className="text-right">
            <p className="text-sm text-gray-400 font-mono tracking-widest uppercase">Balance</p>
            <p className="text-2xl font-black text-brand-secondary cyber-glitch-text" data-text={balance}>
              {balance} ¢
            </p>
          </div>
        </div>

        {/* Slot Machine Grid */}
        <div className="bg-black/50 p-6 rounded-2xl border-2 border-white/10 mb-8 relative overflow-hidden">
          {/* Inner bezel */}
          <div className="absolute inset-0 border-[4px] border-black rounded-xl pointer-events-none z-10" />

          <div className="grid grid-cols-5 gap-4 h-96 relative">
            {/* 5 Columns */}
            {Array.from({ length: 5 }).map((_, colIndex) => (
              <div key={colIndex} className="bg-white/5 rounded-lg border border-white/5 relative overflow-hidden flex flex-col">
                <div
                  className={`absolute inset-0 flex flex-col justify-between p-4 transition-transform duration-100 ${
                    spinCols[colIndex] ? "animate-[ticker_0.2s_linear_infinite]" : ""
                  }`}
                  style={{
                    // Simulate continuous spinning by repeating a lot of elements if spinning
                    height: spinCols[colIndex] ? "300%" : "100%",
                  }}
                >
                  {/* Display actual result if not spinning, or random if spinning */}
                  {Array.from({ length: spinCols[colIndex] ? 9 : 3 }).map((__, rowIndex) => {
                    const actualRow = rowIndex % 3;
                    const symbolStr = matrix[actualRow][colIndex];
                    const isWinning = !spinCols[colIndex] && isWinningCell(actualRow, colIndex);
                    return (
                      <div
                        key={rowIndex}
                        className={`flex-1 flex items-center justify-center ${
                          isWinning ? "animate-pulse scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" : ""
                        }`}
                      >
                        {SYMBOL_MAP[symbolStr] || SYMBOL_MAP["Cherry"]}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Paylines Overlay (simplified visual logic could be added here) */}
        </div>

        {/* Control Panel */}
        <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/10">

          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Total Win</p>
            <div className="h-12 bg-black/50 px-6 rounded-lg flex items-center justify-center border border-white/5 min-w-[120px]">
              <span className={`text-xl font-black ${lastWin > 0 ? "text-green-400 animate-pulse" : "text-gray-600"}`}>
                {lastWin > 0 ? `+${lastWin}` : "0"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2 items-center">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Bet Amount</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBetAmount(Math.max(10, betAmount - 10))}
                  disabled={isSpinning || betAmount <= 10}
                  className="h-12 w-12 border-white/10 text-white bg-black/50"
                >
                  -
                </Button>
                <div className="h-12 bg-black/50 px-6 rounded-lg flex items-center justify-center border border-white/5 min-w-[100px]">
                  <span className="text-xl font-black text-white">{betAmount}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setBetAmount(betAmount + 10)}
                  disabled={isSpinning || betAmount + 10 > balance}
                  className="h-12 w-12 border-white/10 text-white bg-black/50"
                >
                  +
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setBetAmount(balance)}
              disabled={isSpinning || balance <= 0}
              className="h-12 mt-6 border-brand-primary/50 text-brand-primary hover:bg-brand-primary/20 hover:text-white uppercase font-black tracking-widest"
            >
              Max Bet
            </Button>
          </div>

          <Button
            onClick={handleSpin}
            disabled={isSpinning}
            className={`h-20 px-12 text-2xl font-black uppercase tracking-widest rounded-xl transition-all ${
              isSpinning
                ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed"
                : "bg-brand-primary hover:bg-brand-primary/80 text-white border-2 border-brand-primary hover:scale-105 shadow-[0_0_30px_rgba(189,0,255,0.5)]"
            }`}
          >
            {isSpinning ? "Spinning..." : "SPIN"}
          </Button>

        </div>
      </div>
    </div>
  );
}
