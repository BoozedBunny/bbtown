export interface BuildingData {
  id: string;
  name?: string;
  position: [number, number, number];
  rotationY?: number;
  rotationZ?: number;
  rotationX?: number;
  iconPosition?: number;
  image?: string;
  type: string;
  owner?: string;
  ownerAvatar?: string;
  ownerId?: string;
  color?: string;
  price?: number;
  employees?: number;
  title?: string;
  forSale?: boolean;
  scale?: number | [number, number, number];
}

export type ImageBuildingProps = {
  id?: string;
  url: string;
  position: [number, number, number];
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
  ownerId?: string;
  ownerAvatar?: string;
  title?: string;
  ownerName?: string;
  forSale?: boolean;
  price?: number;
  iconPosition?: number;
  isTransformable?: boolean;
  onTransform?: (id: string, position: [number, number, number]) => void;
};

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
    arenaMaxRounds: number;
  } | null;
}
