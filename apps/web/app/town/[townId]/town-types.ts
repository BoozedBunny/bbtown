export interface BuildingData {
  position: [number, number, number];
  url?: string;
  image?: string;
  name?: string;
  id?: string;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  opacity?: number;
  type?: string;
  color?: string;
  onClick?: () => void;
  activeHoverBuildingId?: string | null;
  onHoverBuildingChange?: (id: string | null) => void;
  hoverSuppressed?: boolean;
  scale?: number | [number, number, number];
  owner?: string;
  ownerId?: string;
  ownerAvatar?: string;
  title?: string;
  ownerName?: string;
  employees?: number;
  forSale?: boolean;
  price?: number;
  buildingLevel?: number;
  upgradeEndsAt?: string | null;
  iconPosition?: number;
  isTransformable?: boolean;
  onTransform?: (id: string, position: [number, number, number]) => void;
  spriteConfig?: {
    columns: number;
    rows: number;
    totalFrames: number;
    fps: number;
    phaseOffset?: number;
  };
}

export interface DbBuildingState {
  id: string;
  ownerId?: string;
  owner?: { name?: string | null; avatar?: string | null } | null;
  price?: number;
  title?: string;
  forSale?: boolean;
  employees?: number;
  buildingLevel?: number;
  upgradeEndsAt?: string | null;
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
    arenaMaxRounds: number;
    experience: number;
  } | null;
}
