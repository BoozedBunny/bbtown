export interface BuildingData {
  id: string;
  position: [number, number, number];
  rotationY: number;
  glb?: string;
  type: string;
  owner?: string;
  ownerAvatar?: string;
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
  owner?: { name?: string | null; avatar?: string | null } | null;
  price?: number;
  title?: string;
  forSale?: boolean;
  employees?: number;
}

export interface TownStateData {
  bankBalance?: number;
}

export interface UserWithCharacter {
  id?: string;
  username?: string;
  character?: {
    id: string;
    name: string;
    avatar: string;
    wallet: number;
  } | null;
}
