export interface BuildingData {
  id: string;
  position: [number, number, number];
  rotationY: number;
  glb?: string;
  type: string;
  owner?: string;
  ownerId?: string;
  color?: string;
  price?: number;
  employees?: number;
  title?: string;
  forSale?: boolean;
  scale?: number | [number, number, number],
}

export interface DbBuildingState {
  id: string;
  ownerId?: string;
  owner?: { name?: string | null } | null;
  price?: number;
  title?: string;
  forSale?: boolean;
  employees?: number;
}

export interface TownStateData {
  bankBalance?: number;
}

export interface UserWithCharacter {
  character?: {
    id: string;
    wallet: number;
  } | null;
}
