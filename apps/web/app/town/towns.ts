export const TOWNS = [
  {
    id: "1",
    name: "HangoverHollow",
  },
  {
    id: "2",
    name: "TipsyToadstool",
  },
  {
    id: "3",
    name: "RumTumbleWeed",
  },
] as const;

export type TownId = (typeof TOWNS)[number]["id"];
