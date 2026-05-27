"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Play, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  generatePuzzle,
  isBoardCompleteAndValid,
  isValid,
  Difficulty,
  Board,
} from "@/lib/sudoku";

type Move = {
  row: number;
  col: number;
  prevValue: number | null;
};

export default function Sudoku() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<Board>([]);
  const [initialBoard, setInitialBoard] = useState<Board>([]);
  const [selectedCell, setSelectedCell] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [history, setHistory] = useState<Move[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    startNewGame("easy");
  }, []);

  const startNewGame = (diff: Difficulty) => {
    setDifficulty(diff);
    const { puzzle } = generatePuzzle(diff);
    setBoard(puzzle.map((row) => [...row]));
    setInitialBoard(puzzle.map((row) => [...row]));
    setHistory([]);
    setSelectedCell(null);
    setIsWon(false);
  };

  const handleCellClick = (r: number, c: number) => {
    if (isWon) return;
    if (initialBoard[r][c] !== null) return; // Cannot edit initial cells
    setSelectedCell({ r, c });
  };

  const handleNumberInput = useCallback(
    (num: number | null) => {
      if (isWon || !selectedCell) return;
      const { r, c } = selectedCell;

      if (initialBoard[r][c] !== null) return; // double check

      const prevValue = board[r][c];
      if (prevValue === num) return; // no change

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = num;

      setBoard(newBoard);
      setHistory((prev) => [...prev, { row: r, col: c, prevValue }]);

      if (isBoardCompleteAndValid(newBoard)) {
        setIsWon(true);
        toast.success("Congratulations! You solved the puzzle!");
      }
    },
    [board, initialBoard, isWon, selectedCell],
  );

  const handleUndo = () => {
    if (history.length === 0 || isWon) return;

    const lastMove = history[history.length - 1];
    const newBoard = board.map((row) => [...row]);
    newBoard[lastMove.row][lastMove.col] = lastMove.prevValue;

    setBoard(newBoard);
    setHistory((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isWon) return;
      if (e.key >= "1" && e.key <= "9") {
        handleNumberInput(parseInt(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        handleNumberInput(null);
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNumberInput, handleUndo, isWon]);

  if (!isClient || board.length === 0) return null;

  return (
    <div
      className="min-h-screen bg-black text-white font-sans selection:bg-brand-primary/30 flex flex-col"
      style={{
        backgroundImage: "url('/media/buildings/casino_pyramid_static.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay",
        backgroundColor: "rgba(0, 0, 0, 0.85)", // Darken the image heavily so the game remains playable
      }}
    >
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-cyan-400 drop-shadow-[0_0_10px_rgba(189,0,255,0.5)]">
              Sudoku
            </h1>
            <p className="text-xs text-gray-500 font-mono tracking-widest uppercase mt-1">
              Test your mind
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full">
        {/* Controls */}
        <div className="flex flex-wrap justify-between items-center w-full max-w-[500px] mb-6 gap-4">
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                onClick={() => startNewGame(d)}
                className={`text-xs uppercase tracking-widest font-bold ${
                  difficulty === d
                    ? "bg-brand-primary/20 text-brand-primary border-brand-primary/50 shadow-[0_0_10px_rgba(189,0,255,0.3)]"
                    : "bg-transparent text-gray-400 border-white/10 hover:text-white hover:border-white/30"
                }`}
              >
                {d}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={history.length === 0 || isWon}
              className="text-xs uppercase tracking-widest font-bold bg-transparent text-gray-400 border-white/10 hover:text-white hover:border-white/30"
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startNewGame(difficulty)}
              className="text-xs uppercase tracking-widest font-bold bg-transparent text-brand-primary border-brand-primary/30 hover:bg-brand-primary/10"
            >
              <Play className="w-3 h-3 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Board */}
        <div className="relative aspect-square w-full max-w-[500px] bg-black border-2 border-brand-primary/50 shadow-[0_0_30px_rgba(189,0,255,0.2)] rounded-lg overflow-hidden flex flex-col">
          {isWon && (
            <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-500">
              <div className="w-20 h-20 rounded-full bg-brand-primary/20 border-2 border-brand-primary flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(189,0,255,0.5)]">
                <Check className="w-10 h-10 text-brand-primary" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
                Puzzle Solved
              </h2>
              <p className="text-brand-primary font-mono text-sm tracking-widest uppercase mb-6">
                Difficulty: {difficulty}
              </p>
              <Button
                onClick={() => startNewGame(difficulty)}
                className="bg-brand-primary hover:bg-brand-primary/80 text-white border-2 border-brand-primary font-black uppercase tracking-widest px-8 shadow-[0_0_20px_rgba(189,0,255,0.4)]"
              >
                Play Again
              </Button>
            </div>
          )}

          {board.map((row, rIndex) => (
            <div key={rIndex} className="flex flex-1 w-full">
              {row.map((cellValue, cIndex) => {
                const isInitial = initialBoard[rIndex][cIndex] !== null;
                const isSelected =
                  selectedCell?.r === rIndex && selectedCell?.c === cIndex;
                const isRelated =
                  selectedCell &&
                  !isSelected &&
                  (selectedCell.r === rIndex ||
                    selectedCell.c === cIndex ||
                    (Math.floor(selectedCell.r / 3) ===
                      Math.floor(rIndex / 3) &&
                      Math.floor(selectedCell.c / 3) ===
                        Math.floor(cIndex / 3)));
                const isSameValue =
                  cellValue !== null &&
                  selectedCell &&
                  board[selectedCell.r][selectedCell.c] === cellValue;

                const isInvalid =
                  !isInitial &&
                  cellValue !== null &&
                  !isValid(board, rIndex, cIndex, cellValue);

                let bgClass = "bg-black";
                if (isSelected) bgClass = "bg-brand-primary/40";
                else if (isSameValue) bgClass = "bg-brand-primary/20";
                else if (isRelated) bgClass = "bg-white/5";

                let textClass = "text-white";
                if (isInitial) textClass = "text-gray-400 font-bold";
                else if (isInvalid) textClass = "text-red-500 font-bold";
                else
                  textClass =
                    "text-brand-primary font-bold shadow-brand-primary drop-shadow-[0_0_5px_rgba(189,0,255,0.8)]";

                // Border logic for 3x3 grids
                let borderClass = "border-white/10";
                if (cIndex % 3 === 2 && cIndex !== 8)
                  borderClass += " border-r-brand-primary/50 border-r-2";
                else borderClass += " border-r";

                if (rIndex % 3 === 2 && rIndex !== 8)
                  borderClass += " border-b-brand-primary/50 border-b-2";
                else borderClass += " border-b";

                return (
                  <div
                    key={`${rIndex}-${cIndex}`}
                    onClick={() => handleCellClick(rIndex, cIndex)}
                    className={`flex-1 flex items-center justify-center text-xl sm:text-2xl cursor-pointer transition-colors select-none ${bgClass} ${borderClass} ${textClass} ${
                      isInitial ? "cursor-default" : "hover:bg-white/10"
                    }`}
                  >
                    {cellValue || ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Number Pad */}
        <div className="w-full max-w-[500px] mt-6 grid grid-cols-5 sm:grid-cols-10 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Button
              key={num}
              variant="outline"
              onClick={() => handleNumberInput(num)}
              disabled={isWon || !selectedCell}
              className="h-12 bg-black/50 border-white/10 text-white hover:bg-brand-primary/20 hover:text-brand-primary hover:border-brand-primary/50 text-xl font-bold font-mono"
            >
              {num}
            </Button>
          ))}
          <Button
            variant="outline"
            onClick={() => handleNumberInput(null)}
            disabled={isWon || !selectedCell}
            className="h-12 bg-black/50 border-white/10 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 text-xs font-bold uppercase tracking-widest sm:col-span-1 col-span-1"
          >
            Del
          </Button>
        </div>
      </main>
    </div>
  );
}
