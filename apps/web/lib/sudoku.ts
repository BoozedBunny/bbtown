export type Difficulty = "easy" | "medium" | "hard";
export type Board = (number | null)[][];

// Helper to get an empty 9x9 board
export const getEmptyBoard = (): Board => {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
};

// Check if a number can be placed at board[row][col]
export const isValid = (board: Board, row: number, col: number, num: number): boolean => {
  // Check row
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num && i !== col) return false;
  }
  // Check col
  for (let i = 0; i < 9; i++) {
    if (board[i][col] === num && i !== row) return false;
  }
  // Check 3x3 box
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
        return false;
      }
    }
  }
  return true;
};

// Solve the board using backtracking
export const solveBoard = (board: Board): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveBoard(board)) {
              return true;
            }
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
};

// Shuffle an array
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Generate a fully solved valid board
export const generateSolvedBoard = (): Board => {
  const board = getEmptyBoard();

  const fillBoard = (board: Board): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === null) {
          const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of numbers) {
            if (isValid(board, row, col, num)) {
              board[row][col] = num;
              if (fillBoard(board)) {
                return true;
              }
              board[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  fillBoard(board);
  return board;
};

// Generate a puzzle by removing numbers
export const generatePuzzle = (difficulty: Difficulty): { puzzle: Board; solution: Board } => {
  const solution = generateSolvedBoard();
  const puzzle = solution.map(row => [...row]);

  let cellsToRemove = 0;
  switch (difficulty) {
    case "easy":
      cellsToRemove = 30; // Leaves 51
      break;
    case "medium":
      cellsToRemove = 45; // Leaves 36
      break;
    case "hard":
      cellsToRemove = 60; // Leaves 21
      break;
  }

  let removed = 0;
  while (removed < cellsToRemove) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);

    if (puzzle[row][col] !== null) {
      puzzle[row][col] = null;
      removed++;
    }
  }

  return { puzzle, solution };
};

// Check if the board is completely filled and valid
export const isBoardCompleteAndValid = (board: Board): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const val = board[row][col];
      if (val === null) return false;
      if (!isValid(board, row, col, val)) return false;
    }
  }
  return true;
};
