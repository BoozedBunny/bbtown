"use client";

import { ArenaGlobalToplist } from "@/components/ArenaGlobalToplist";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { VideoSkyBg } from "@/components/VideoSkyBg";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import dynamic from "next/dynamic";
/* const LoaderWrapper = dynamic(() => import("@/components/ui/LoaderWrapper").then((mod) => mod.LoaderWrapper), { ssr: false }); */
import { useEffect, useState, use, useMemo, useRef, useCallback } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera } from "three";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Swords, Trophy, Loader2, X, Menu, Dices } from "lucide-react";
import { ImageBuilding } from "@/components/ImageBuilding";
import { ModelX } from "@/components/ModelX";
import { TexturedGround } from "@/components/TexturedGround";
import { DayNightCycle } from "@/components/DayNightCycle";
import { RoadTile } from "@/components/RoadTile";
import { CombinedMarketView } from "@/components/CombinedMarketView";
import { MarketTickerTape } from "@/components/MarketTickerTape";
import { TownChatPanel } from "@/components/TownChatPanel";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "../../actions/user";
import { buyBuilding, updateBuildingSettings } from "../../actions/town";
import { updateBuildingTransform } from "../../actions/dev";
import {
  ARENA_BUILDING_ID,
  BANK_BUILDING_ID,
  CASINO_BUILDING_ID,
  STOCK_EXCHANGE_BUILDING_ID,
  HARDCODED_BUILDINGS,
} from "./town-config";
import type {
  BuildingData,
  DbBuildingState,
  TownStateData,
  UserWithCharacter,
} from "./town-types";
import type {
  CentralManagementIntent,
  CentralManagementTab,
} from "@/lib/ui/centralManagementIntent";

type WalletSummaryCategory = {
  key: string;
  label: string;
  amount: number | null;
  enabled: boolean;
};

type WalletSummaryViewModel = {
  totalBalance: number | null;
  income: number | null;
  expenses: number | null;
  currencyCode: string;
  categories: WalletSummaryCategory[];
  lastUpdatedAt: string | null;
};

const WALLET_CATEGORY_DEFAULTS: Array<{ key: string; label: string }> = [
  { key: "trading", label: "Trading" },
  { key: "quests", label: "Quests" },
  { key: "rewards", label: "Rewards" },
  { key: "fees", label: "Fees" },
  { key: "other", label: "Other" },
];

const formatCurrencyAmount = (
  value: number | null,
  currencyCode: string,
): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
};

type TownCameraPanDebug = {
  targetX: number;
  minX: number;
  maxX: number;
  rawDeltaX: number;
  appliedDeltaX: number;
  clampHits: number;
};

const TOWN_CAMERA_PAN_CONFIG = {
  dragSensitivity: 1.5,
  cityMarginWorld: 2,
  minSoftSpan: 1,
};

function Scene({
  buildings,
  onBuildingClick,
  cameraMode,
  freeMoveBuildingId,
  onGroundPointerMove,
  onGroundClick,
  serverTime,
  horizontalPanEnabled,
  onPanDebugChange,
  isFreePositionMode,
  onTransform,
}: {
  buildings: BuildingData[];
  onBuildingClick: (b: BuildingData) => void;
  cameraMode: "game" | "dev";
  freeMoveBuildingId?: string | null;
  onGroundPointerMove?: (e: any) => void;
  onGroundClick?: (e: any) => void;
  serverTime?: string;
  activeHoverBuildingId?: string | null;
  onHoverBuildingChange?: (id: string | null) => void;
  hoverSuppressed?: boolean;
  horizontalPanEnabled?: boolean;
  onPanDebugChange?: (debug: TownCameraPanDebug) => void;
  isFreePositionMode?: boolean;
  onTransform?: (id: string, position: [number, number, number]) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const clampHitsRef = useRef(0);
  const panLastTargetXRef = useRef<number | null>(null);

  // Berechnet jetzt X- und Z-Grenzen der Stadt
  const cityBounds = useMemo(() => {
    if (!buildings.length) {
      return { minX: -12, maxX: 12, minZ: -12, maxZ: 12 };
    }
    const xs = buildings.map((building) => building.position[0]);
    const zs = buildings.map((building) => building.position[2]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
  }, [buildings]);

  const getHorizontalFootprintHalfWidth = useCallback((camera: Camera) => {
    const typedCamera = camera as any;
    if (typedCamera.isOrthographicCamera && typedCamera.zoom) {
      return ((typedCamera.right - typedCamera.left) / typedCamera.zoom) * 0.5;
    }
    return 0;
  }, []);

  const getVerticalFootprintHalfHeight = useCallback((camera: Camera) => {
    const typedCamera = camera as any;
    if (typedCamera.isOrthographicCamera && typedCamera.zoom) {
      return ((typedCamera.top - typedCamera.bottom) / typedCamera.zoom) * 0.5;
    }
    return 0;
  }, []);

  // Neue 2D-Clamp Funktion für X und Z
  const applyPanClamp = useCallback(() => {
    if (!horizontalPanEnabled || cameraMode !== "game") return;

    const controls = controlsRef.current;
    if (!controls) return;

    const halfWidth = getHorizontalFootprintHalfWidth(controls.object);
    const halfHeight = getVerticalFootprintHalfHeight(controls.object);

    // X-Axis Clamp mit Schutz vor Überschneidung
    let minXBound =
      cityBounds.minX - TOWN_CAMERA_PAN_CONFIG.cityMarginWorld + halfWidth;
    let maxXBound =
      cityBounds.maxX + TOWN_CAMERA_PAN_CONFIG.cityMarginWorld - halfWidth;

    // Wenn wir zu weit rauszoomen (min > max), zentrieren wir die Kamera auf der X-Achse
    if (minXBound > maxXBound) {
      const center = (cityBounds.minX + cityBounds.maxX) / 2;
      minXBound = center;
      maxXBound = center;
    }

    const currentTargetX = controls.target.x;
    const clampedTargetX = Math.min(
      Math.max(currentTargetX, minXBound),
      maxXBound,
    );

    // Z-Axis Clamp (Depth) mit Schutz vor Überschneidung
    let minZBound =
      cityBounds.minZ - TOWN_CAMERA_PAN_CONFIG.cityMarginWorld + halfHeight;
    let maxZBound =
      cityBounds.maxZ + TOWN_CAMERA_PAN_CONFIG.cityMarginWorld - halfHeight;
    // Wenn wir zu weit rauszoomen (min > max), zentrieren wir die Kamera auf der Z-Achse
    if (minZBound > maxZBound) {
      const center = (cityBounds.minZ + cityBounds.maxZ) / 2;
      minZBound = center;
      maxZBound = center;
    }

    const currentTargetZ = controls.target.z;
    const clampedTargetZ = Math.min(
      Math.max(currentTargetZ, minZBound),
      maxZBound,
    );

    const deltaX = clampedTargetX - currentTargetX;
    const deltaZ = clampedTargetZ - currentTargetZ;

    // Apply corrections if out of bounds
if (Math.abs(deltaX) > 1e-6 || Math.abs(deltaZ) > 1e-6) {
      clampHitsRef.current += 1;
      controls.target.set(clampedTargetX, controls.target.y, clampedTargetZ);
      controls.object.position.x += deltaX;
      controls.object.position.z += deltaZ;
    }
  }, [
    cameraMode,
    cityBounds,
    getHorizontalFootprintHalfWidth,
    getVerticalFootprintHalfHeight,
    horizontalPanEnabled,
  ]);

  useEffect(() => {
    if (!horizontalPanEnabled || cameraMode !== "game") return;

    const controls = controlsRef.current;
    if (!controls) return;

    const onControlsChange = () => {
      applyPanClamp();
    };

    controls.panSpeed = TOWN_CAMERA_PAN_CONFIG.dragSensitivity;
    controls.addEventListener("change", onControlsChange);
    applyPanClamp();

    return () => {
      controls.removeEventListener("change", onControlsChange);
    };
  }, [applyPanClamp, cameraMode, horizontalPanEnabled]);

  return (
    <>
      <DayNightCycle serverTime={serverTime} />

      {/* Looping WebM Video Background */}
      <VideoSkyBg
        url="https://www.boozedbunnytown.com/media/textures/sky.webm"
        onPointerMove={onGroundPointerMove}
        onClick={onGroundClick}
      />

      {/* Dein neues Bild als Boden */}
      <TexturedGround
        url="https://www.boozedbunnytown.com/media/textures/open_bg.webp"
        onPointerMove={onGroundPointerMove}
        onClick={onGroundClick}
      />

      {/* <gridHelper args={[30, 30, "#BD00FF", "#2A0A4E"]} position={[0, 0.02, 0]}>
         <meshBasicMaterial transparent opacity={0.2} />
      </gridHelper> */}

      {buildings.map((b) => {
        const isXRayActive = freeMoveBuildingId === b.id;

        return (
          <ImageBuilding
            key={b.id}
            id={b.id}
            url={b.image!} // Hier wird jetzt das webp übergeben
            position={b.position}
            opacity={!isXRayActive ? 1 : 0.4}
            rotationY={b.rotationY || 0}
            rotationX={b.rotationX || 0}
            rotationZ={b.rotationZ || 0}
            onClick={() => {
              if (!freeMoveBuildingId) onBuildingClick(b);
            }}
            scale={b.scale || 1}
            ownerId={b.ownerId}
            ownerAvatar={b.ownerAvatar}
            title={b.title || b.name}
            ownerName={b.owner}
            forSale={b.forSale}
            price={b.price}
            iconPosition={b.iconPosition}
            isTransformable={cameraMode === "dev" && isFreePositionMode}
            onTransform={onTransform}
          />
        );
      })}

      {/* <ModelX
        url="https://www.boozedbunnytown.com/media/models/bbtown_sign1-v3-v5.glb"
        position={[5.8, 0.69, 4.2]}
        opacity={1}
        rotationY={90}
      />

      <ModelX
        url="https://www.boozedbunnytown.com/media/models/ground.glb"
        position={[0, -2.36, 0]}
        opacity={1}
        scale={20}
      /> */}

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={30}
        blur={2}
        far={1}
      />
      <OrbitControls
        makeDefault
        ref={controlsRef}
        enablePan={
          cameraMode === "dev" ||
          (cameraMode === "game" && !!horizontalPanEnabled)
        }
        enableRotate={cameraMode === "dev"}
        zoomSpeed={0.5}
        minZoom={cameraMode === "game" ? 80 : 0.1}
        maxZoom={cameraMode === "game" ? 120 : 1000}
        minPolarAngle={cameraMode === "game" ? 0 : 0}
        maxPolarAngle={cameraMode === "game" ? 0 : Math.PI}
        mouseButtons={
          cameraMode === "game"
            ? {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,
              }
            : {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN,
              }
        }
      />
    </>
  );
}

export default function TownPage({
  params,
}: {
  params: Promise<{ townId: string }>;
}) {
  const { townId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeHoverBuildingId, setActiveHoverBuildingId] = useState<
    string | null
  >(null);
  const [isFreePositionMode, setIsFreePositionMode] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(
    null,
  );
  const [cameraMode, setCameraMode] = useState<"game" | "dev">("game");
  const [movingBuilding, setMovingBuilding] = useState<BuildingData | null>(
    null,
  );
  const [freeMoveBuildingId, setFreeMoveBuildingId] = useState<string | null>(
    null,
  );
  const [freeMovePosition, setFreeMovePosition] = useState<
    [number, number, number] | null
  >(null);
  const [stepSize, setStepSize] = useState<number>(0.5);
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, [number, number, number]>
  >({});
  const [rotationOverrides, setRotationOverrides] = useState<
    Record<string, number>
  >({});
  const [dbBuildingStates, setDbBuildingStates] = useState<DbBuildingState[]>(
    [],
  );
  const [townData, setTownData] = useState<TownStateData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverTime, setServerTime] = useState<string | undefined>(undefined);
  const [showCombinedView, setShowCombinedView] = useState(false);
  const [marketIntent, setMarketIntent] =
    useState<CentralManagementIntent | null>(null);
  const [showArenaModal, setShowArenaModal] = useState(false);
  const [showCasinoModal, setShowCasinoModal] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<
    "idle" | "searching" | "matched"
  >("idle");
  const [isTopNavMenuOpen, setIsTopNavMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuItemRefs = useRef<
    Array<HTMLButtonElement | HTMLAnchorElement | null>
  >([]);

  const emitNavEvent = useCallback(
    (
      eventName: "nav_menu_opened" | "nav_menu_closed" | "nav_item_clicked",
      payload?: Record<string, string>,
    ) => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent(eventName, { detail: payload ?? {} }),
      );
    },
    [],
  );

  const closeTopNavMenu = useCallback(
    (
      reason:
        | "escape"
        | "outside_click"
        | "item_click"
        | "toggle"
        | "close_button"
        | "route_change"
        | "blur",
      returnFocus = false,
    ) => {
      setIsTopNavMenuOpen((prev) => {
        if (!prev) return prev;
        emitNavEvent("nav_menu_closed", {
          viewport:
            typeof window === "undefined"
              ? "unknown"
              : window.innerWidth < 1024
                ? "mobile"
                : "desktop",
          page: pathname,
          auth_state: "unknown",
          reason,
        });
        return false;
      });
      if (returnFocus) {
        requestAnimationFrame(() => {
          burgerButtonRef.current?.focus();
        });
      }
    },
    [emitNavEvent, pathname],
  );

  const runtimeMode: "game" | "dev" = cameraMode;
  const canViewGeoPosition = runtimeMode === "dev";

  const hoverSuppressed = useMemo(
    () => !!selectedBuilding || showArenaModal || showCasinoModal || showCombinedView,
    [selectedBuilding, showArenaModal, showCasinoModal, showCombinedView],
  );
  const [editForm, setEditForm] = useState({
    title: "",
    price: 5000,
    forSale: false,
  });
  const [currentUser, setCurrentUser] = useState<UserWithCharacter | null>(
    null,
  );

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalCharacterId, setProfileModalCharacterId] = useState<
    string | null
  >(null);
  const topNavFeatureFlag =
    process.env.NEXT_PUBLIC_HEADER_BURGER_NAV_V1 ??
    process.env.NEXT_PUBLIC_TOPNAV_REFACTOR_V2 ??
    "true";
  const isTopNavRefactorEnabled = topNavFeatureFlag !== "false";
  const cameraPanFeatureFlag =
    process.env.NEXT_PUBLIC_TOWN_CAMERA_HORIZONTAL_PAN ?? "true";
  const isTownCameraHorizontalPanEnabled = cameraPanFeatureFlag === "true";
  const cameraPanDebugFeatureFlag =
    process.env.NEXT_PUBLIC_TOWN_CAMERA_HORIZONTAL_PAN_DEBUG ?? "false";
  const isTownCameraPanDebugEnabled = cameraPanDebugFeatureFlag === "true";
  const [townCameraPanDebug, setTownCameraPanDebug] =
    useState<TownCameraPanDebug>({
      targetX: 0,
      minX: 0,
      maxX: 0,
      rawDeltaX: 0,
      appliedDeltaX: 0,
      clampHits: 0,
    });

  useEffect(() => {
    if (!isTownCameraHorizontalPanEnabled || !isTownCameraPanDebugEnabled)
      return;
    if (
      townCameraPanDebug.clampHits === 0 ||
      townCameraPanDebug.clampHits % 10 !== 0
    )
      return;
    console.debug("[TownCameraPan]", {
      targetX: Number(townCameraPanDebug.targetX.toFixed(3)),
      minX: Number(townCameraPanDebug.minX.toFixed(3)),
      maxX: Number(townCameraPanDebug.maxX.toFixed(3)),
      rawDeltaX: Number(townCameraPanDebug.rawDeltaX.toFixed(3)),
      appliedDeltaX: Number(townCameraPanDebug.appliedDeltaX.toFixed(3)),
      clampHits: townCameraPanDebug.clampHits,
    });
  }, [
    isTownCameraHorizontalPanEnabled,
    isTownCameraPanDebugEnabled,
    townCameraPanDebug,
  ]);
  const walletModalFeatureFlag =
    process.env.NEXT_PUBLIC_WALLET_MODAL_ENABLED ?? "true";
  const isWalletModalEnabled = walletModalFeatureFlag !== "false";
  const walletPositionFeatureFlag =
    process.env.NEXT_PUBLIC_HEADER_WALLET_POSITION_V2 ?? "true";
  const isWalletPositionV2Enabled = walletPositionFeatureFlag !== "false";
  const chatFeatureFlag =
    process.env.NEXT_PUBLIC_CHAT_EPIC3_ENABLED ??
    process.env.NEXT_PUBLIC_CHAT_EPIC1_ENABLED ??
    "false";
  const isChatWhisperEnabled = chatFeatureFlag === "true";

  type HeaderNavItem = {
    id: string;
    label: string;
    group: "core" | "economy" | "community" | "account";
    priority: number;
    onSelect?: () => void;
    href?: string;
  };

  const headerNavItems = useMemo<HeaderNavItem[]>(
    () => [
      ...(process.env.NODE_ENV !== "production"
        ? [
            {
              id: "camera",
              label: cameraMode === "game" ? "Dev Mode" : "Game Mode",
              group: "core" as const,
              priority: 20,
              onSelect: () =>
                setCameraMode((prev) => (prev === "game" ? "dev" : "game")),
            },
          ]
        : []),
      {
        id: "profile",
        label: "My Profile",
        group: "community",
        priority: 25,
        onSelect: () => {
          if (currentUser?.character) {
            setProfileModalCharacterId(currentUser.character.id);
            setProfileModalOpen(true);
          } else {
            toast.error("Please log in to view your profile.");
          }
        },
      },
      {
        id: "news",
        label: "News",
        group: "community",
        priority: 30,
        href: `/town/${townId}/news`,
      },
      {
        id: "back-lobby",
        label: "Back to Lobby",
        group: "account",
        priority: 40,
        href: "/lobby",
      },
    ],
    [cameraMode, townId, currentUser],
  );

  const groupedHeaderNavItems = useMemo(() => {
    const groups: Array<{ key: HeaderNavItem["group"]; label: string }> = [
      { key: "core", label: "Core" },
      { key: "economy", label: "Economy" },
      { key: "community", label: "Community" },
      { key: "account", label: "Account" },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: headerNavItems
          .filter((item) => item.group === group.key)
          .sort((a, b) => a.priority - b.priority),
      }))
      .filter((group) => group.items.length > 0);
  }, [headerNavItems]);

  const walletSummary = useMemo<WalletSummaryViewModel>(() => {
    const wallet = currentUser?.character?.wallet ?? null;
    return {
      totalBalance: wallet,
      income: null,
      expenses: null,
      currencyCode: "USD",
      categories: WALLET_CATEGORY_DEFAULTS.map((category) => ({
        ...category,
        amount: null,
        enabled: true,
      })),
      lastUpdatedAt: null,
    };
  }, [currentUser]);

  const getNavAnalyticsContext = useCallback(() => {
    const viewport =
      typeof window === "undefined"
        ? "unknown"
        : window.innerWidth < 1024
          ? "mobile"
          : "desktop";
    return {
      viewport,
      page: pathname,
      auth_state: currentUser ? "authenticated" : "anonymous",
    };
  }, [currentUser, pathname]);

  const updateCentralManagementQuery = (
    tab: CentralManagementTab,
    symbol?: string | null,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cm", tab);
    if (tab === "market" && symbol?.trim()) {
      params.set("symbol", symbol.trim().toUpperCase());
    } else {
      params.delete("symbol");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const openCentralManagement = (intent: CentralManagementIntent) => {
    setMarketIntent(intent);
    setShowCombinedView(true);
    updateCentralManagementQuery(intent.tab, intent.symbol ?? null);
  };

  const closeCentralManagement = () => {
    setShowCombinedView(false);
    setMarketIntent(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cm");
    params.delete("symbol");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (!isTopNavRefactorEnabled || !isTopNavMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        burgerButtonRef.current?.contains(target)
      ) {
        return;
      }
      closeTopNavMenu("outside_click");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeTopNavMenu("escape", true);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeTopNavMenu, isTopNavMenuOpen, isTopNavRefactorEnabled]);

  useEffect(() => {
    if (!isTopNavRefactorEnabled || !isTopNavMenuOpen) return;
    const menuElement = dropdownRef.current;
    if (!menuElement) return;

    const focusableElements = menuElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements.length) return;

    focusableElements[0].focus();
  }, [isTopNavMenuOpen, isTopNavRefactorEnabled]);

  useEffect(() => {
    if (!isTopNavRefactorEnabled) return;
    closeTopNavMenu("route_change");
  }, [pathname, searchParams, isTopNavRefactorEnabled, closeTopNavMenu]);

  useEffect(() => {
    if (!isTopNavRefactorEnabled) return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncMode = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches) return;
      closeTopNavMenu("blur");
    };

    syncMode(mediaQuery);
    mediaQuery.addEventListener("change", syncMode);
    return () => {
      mediaQuery.removeEventListener("change", syncMode);
    };
  }, [closeTopNavMenu, isTopNavRefactorEnabled]);

  useEffect(() => {
    const cm = searchParams.get("cm");
    if (cm !== "market" && cm !== "treasury" && cm !== "news") return;

    const symbol = searchParams.get("symbol");
    const intent: CentralManagementIntent = {
      tab: cm,
      symbol: cm === "market" ? symbol : null,
      source: "query",
    };
    setMarketIntent(intent);
    setShowCombinedView(true);
  }, [searchParams]);

  const handleMove = async (axis: "x" | "y" | "z" | "rot", dir: 1 | -1) => {
    if (!movingBuilding) return;
    const currentPos =
      positionOverrides[movingBuilding.id] || movingBuilding.position;
    const currentRot =
      rotationOverrides[movingBuilding.id] ?? movingBuilding.rotationY;

    const newPos: [number, number, number] = [...currentPos];
    let newRot = currentRot;

    if (axis === "x") newPos[0] += dir * stepSize;
    if (axis === "y") newPos[1] += dir * stepSize;
    if (axis === "z") newPos[2] += dir * stepSize;
    if (axis === "rot") newRot += dir * (stepSize * 10);

    setPositionOverrides((prev) => ({ ...prev, [movingBuilding.id]: newPos }));
    setRotationOverrides((prev) => ({ ...prev, [movingBuilding.id]: newRot }));
    setMovingBuilding({
      ...movingBuilding,
      position: newPos,
      rotationY: newRot,
    });

    // Update the hardcoded file
    await updateBuildingTransform(movingBuilding.id, newPos, newRot);
  };

  useEffect(() => {
    // Fetch dynamic building state
    const fetchUser = async () => {
      try {
        const u = await getCurrentUser();
        setCurrentUser(u);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUser();

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/town/${townId}/state`);
        if (res.ok) {
          const data = await res.json();
          setDbBuildingStates(data.buildings || []);
          setTownData(data.town || null);
          setServerTime(data.serverTime);
        }
      } catch (error) {
        console.error("Failed to fetch building states", error);
      }
    };
    fetchState();

    const socketInstance = io();

    socketInstance.on("connect", () => {
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
    });

    socketInstance.on("building_updated", () => {
      // Re-fetch building states when another user buys a building
      fetchState();
    });

    socketInstance.on("portfolio_updated", () => {
      // Re-fetch user data to update wallet in header
      fetchUser();
    });

    socketInstance.on("match_found", ({ gameRoomId }) => {
      setMatchmakingStatus("matched");
      router.push(`/arena/${gameRoomId}`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [townId, router]);

  const mergedBuildings = useMemo(() => {
    return HARDCODED_BUILDINGS.map((b) => {
      const isFreeMoving = freeMoveBuildingId === b.id;
      const pos =
        isFreeMoving && freeMovePosition
          ? ([freeMovePosition[0], b.position[1], freeMovePosition[2]] as [
              number,
              number,
              number,
            ])
          : positionOverrides[b.id] || b.position;
      const rot = rotationOverrides[b.id] ?? b.rotationY;

      const dbState = dbBuildingStates.find((ds) => ds.id === b.id);
      if (dbState) {
        return {
          position: pos,
          rotationY: rot,
          ...b,
          owner: dbState.owner?.name || "Unowned",
          ownerAvatar: dbState.owner?.avatar || "bunny",
          ownerId: dbState.ownerId,
          price: dbState.price,
          title: dbState.title,
          forSale: dbState.forSale,
          employees: dbState.employees,
        };
      }
      return { ...b, position: pos, rotationY: rot };
    });
  }, [
    dbBuildingStates,
    freeMoveBuildingId,
    freeMovePosition,
    positionOverrides,
    rotationOverrides,
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-white font-sans overflow-hidden relative brand-bg-overlay">
      <div className="relative z-40 w-full max-w-6xl mb-8">
        <div className="w-full cyber-panel p-4 md:p-6 shadow-xl relative border-t-4 border-t-brand-primary">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading font-bold tracking-tight text-white flex items-center gap-3">
                <button
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 -m-1"
                  onClick={() =>
                    openCentralManagement({
                      tab: "treasury",
                      source: "manual",
                    })
                  }
                  aria-label="Open Town Central Management"
                >
                  <div
                    className="relative"
                    style={{
                      width: "clamp(48px, 5.2vw, 78px)",
                      height: "clamp(48px, 5.2vw, 78px)",
                    }}
                  >
                    <Image
                      src="https://www.boozedbunnytown.com/media/logo.png"
                      alt="BB"
                      fill
                      className="object-contain drop-shadow-[0_0_10px_rgba(189,0,255,0.5)]"
                    />
                  </div>
                  <span
                    className="text-[clamp(1.1rem,2vw,1.85rem)] leading-tight font-black italic tracking-tighter cyber-glitch-text"
                    data-text={`BoozedBunnyTown #${townId}`}
                  >
                    BoozedBunnyTown{" "}
                    <span className="text-brand-secondary">#{townId}</span>
                  </span>
                </button>
              </h1>
              {!isWalletPositionV2Enabled && currentUser?.character && (
                <div className="mt-2">
                  <button
                    ref={walletButtonRef}
                    type="button"
                    aria-label="Open wallet summary"
                    onClick={() => {
                      if (!isWalletModalEnabled) return;
                      setIsWalletModalOpen(true);
                    }}
                    className="group relative min-h-11 inline-block"
                  >
                    <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                    <div className="cyber-skew bg-brand-primary/20 border border-brand-primary/50 px-4 py-1 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1">
                      <span className="text-sm font-black uppercase tracking-[0.2em] text-brand-secondary">
                        💰{" "}
                        {formatCurrencyAmount(
                          walletSummary.totalBalance,
                          walletSummary.currencyCode,
                        )}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {isTopNavRefactorEnabled ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <nav
                  aria-label="Town navigation"
                  className="hidden lg:flex items-center gap-2"
                >
                  {headerNavItems.map((item) => {
                    if (item.href) {
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => {
                            emitNavEvent("nav_item_clicked", {
                              ...getNavAnalyticsContext(),
                              item_key: item.id,
                              href: item.href ?? "",
                              position: String(
                                headerNavItems.findIndex(
                                  (menuItem) => menuItem.id === item.id,
                                ) + 1,
                              ),
                            });
                          }}
                          className="min-h-11 rounded-lg px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary inline-flex items-center"
                        >
                          <span className="max-w-full truncate">
                            {item.label}
                          </span>
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          emitNavEvent("nav_item_clicked", {
                            ...getNavAnalyticsContext(),
                            item_key: item.id,
                            href: item.href ?? "",
                            position: String(
                              headerNavItems.findIndex(
                                (menuItem) => menuItem.id === item.id,
                              ) + 1,
                            ),
                          });
                          item.onSelect?.();
                        }}
                        className="min-h-11 rounded-lg px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        <span className="max-w-full block truncate">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>
                <div
                  className={`hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${connected ? "text-green-400" : "text-red-400"}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
                  />
                  {connected ? "Live System" : "Offline"}
                </div>
                {isWalletPositionV2Enabled && (
                  <button
                    ref={walletButtonRef}
                    type="button"
                    aria-label="Open wallet summary"
                    onClick={() => {
                      if (!isWalletModalEnabled) return;
                      setIsWalletModalOpen(true);
                    }}
                    className="group relative min-h-11 inline-block"
                  >
                    <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                    <div className="cyber-skew bg-brand-primary/20 border border-brand-primary/50 px-4 py-2 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1">
                      <span className="text-sm font-black uppercase tracking-[0.2em] text-brand-secondary">
                        {currentUser?.character
                          ? `💰 ${formatCurrencyAmount(walletSummary.totalBalance, walletSummary.currencyCode)}`
                          : "Wallet"}
                      </span>
                    </div>
                  </button>
                )}
                <button
                  ref={burgerButtonRef}
                  type="button"
                  onClick={() => {
                    if (isTopNavMenuOpen) {
                      closeTopNavMenu("toggle");
                      return;
                    }
                    emitNavEvent("nav_menu_opened", getNavAnalyticsContext());
                    setIsTopNavMenuOpen(true);
                  }}
                  aria-label={
                    isTopNavMenuOpen
                      ? "Close navigation menu"
                      : "Open navigation menu"
                  }
                  aria-expanded={isTopNavMenuOpen}
                  aria-controls="top-nav-menu"
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown") return;
                    event.preventDefault();
                    if (!isTopNavMenuOpen) {
                      emitNavEvent("nav_menu_opened", getNavAnalyticsContext());
                      setIsTopNavMenuOpen(true);
                      return;
                    }
                    const firstItem = menuItemRefs.current.find(Boolean);
                    firstItem?.focus();
                  }}
                  className="lg:hidden min-h-11 min-w-11 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary inline-flex items-center justify-center"
                >
                  {isTopNavMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                {process.env.NODE_ENV !== "production" && (
                  <Button
                    variant={cameraMode === "dev" ? "default" : "outline"}
                    onClick={() =>
                      setCameraMode(cameraMode === "game" ? "dev" : "game")
                    }
                    className="text-xs"
                  >
                    {cameraMode === "game" ? "Dev Mode" : "Game Mode"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    openCentralManagement({
                      tab: "news",
                      source: "news",
                    })
                  }
                  className="text-xs border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  News
                </Button>
                <div
                  className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] ${connected ? "text-green-400" : "text-red-400"}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
                  />
                  {connected ? "Live System" : "Offline"}
                </div>
                <Link href="/lobby">
                  <Button
                    variant="ghost"
                    className="text-xs hover:text-brand-secondary transition-colors text-gray-400 uppercase tracking-widest font-bold"
                  >
                    Back to Lobby
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {isTopNavRefactorEnabled && isTopNavMenuOpen && (
          <div
            id="top-nav-menu"
            ref={dropdownRef}
            aria-label="Town navigation menu"
            className="fixed left-4 right-4 top-4 z-[60] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-white/15 bg-[#0B0714]/95 backdrop-blur-xl p-3 shadow-2xl md:absolute md:left-auto md:right-4 md:top-[calc(100%+0.75rem)] md:w-[min(28rem,calc(100vw-2rem))]"
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Navigation
              </p>
              <button
                type="button"
                onClick={() => closeTopNavMenu("close_button", true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="Town navigation">
              <ul
                className="flex flex-col gap-1"
                onKeyDown={(event) => {
                  const items = menuItemRefs.current.filter(Boolean) as Array<
                    HTMLButtonElement | HTMLAnchorElement
                  >;
                  if (!items.length) return;
                  const currentIndex = items.findIndex(
                    (item) => item === document.activeElement,
                  );

                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeTopNavMenu("escape", true);
                    return;
                  }

                  if (
                    event.key === "Tab" &&
                    !event.shiftKey &&
                    currentIndex === items.length - 1
                  ) {
                    closeTopNavMenu("blur");
                    return;
                  }

                  if (
                    !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                  )
                    return;
                  event.preventDefault();

                  if (event.key === "Home") {
                    items[0]?.focus();
                    return;
                  }
                  if (event.key === "End") {
                    items[items.length - 1]?.focus();
                    return;
                  }
                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  const nextIndex =
                    currentIndex < 0
                      ? 0
                      : (currentIndex + delta + items.length) % items.length;
                  items[nextIndex]?.focus();
                }}
              >
                {groupedHeaderNavItems.map((group) => (
                  <li key={group.key} className="mt-2 first:mt-0">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      {group.label}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {group.items.map((item) => {
                        if (item.href) {
                          return (
                            <li key={item.id}>
                              <Link
                                ref={(el) => {
                                  const currentIndex = headerNavItems.findIndex(
                                    (menuItem) => menuItem.id === item.id,
                                  );
                                  menuItemRefs.current[currentIndex] = el;
                                }}
                                title={item.label}
                                href={item.href}
                                onClick={() => {
                                  emitNavEvent("nav_item_clicked", {
                                    ...getNavAnalyticsContext(),
                                    item_key: item.id,
                                    href: item.href ?? "",
                                    position: String(
                                      headerNavItems.findIndex(
                                        (menuItem) => menuItem.id === item.id,
                                      ) + 1,
                                    ),
                                  });
                                  closeTopNavMenu("item_click");
                                }}
                                className="w-full min-h-11 rounded-lg px-3 text-left text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary inline-flex items-center"
                              >
                                <span className="max-w-full truncate">
                                  {item.label}
                                </span>
                              </Link>
                            </li>
                          );
                        }
                        return (
                          <li key={item.id}>
                            <button
                              ref={(el) => {
                                const currentIndex = headerNavItems.findIndex(
                                  (menuItem) => menuItem.id === item.id,
                                );
                                menuItemRefs.current[currentIndex] = el;
                              }}
                              title={item.label}
                              type="button"
                              onClick={() => {
                                emitNavEvent("nav_item_clicked", {
                                  ...getNavAnalyticsContext(),
                                  item_key: item.id,
                                  href: item.href ?? "",
                                  position: String(
                                    headerNavItems.findIndex(
                                      (menuItem) => menuItem.id === item.id,
                                    ) + 1,
                                  ),
                                });
                                item.onSelect?.();
                                closeTopNavMenu("item_click", true);
                              }}
                              className="w-full min-h-11 rounded-lg px-3 text-left text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                              <span className="max-w-full block truncate">
                                {item.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
                <li className="mt-2 border-t border-white/10 pt-3">
                  <div
                    className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] px-3 ${connected ? "text-green-400" : "text-red-400"}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
                    />
                    {connected ? "Live System" : "Offline"}
                  </div>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      <div className="relative w-full h-[75vh] border-2 border-brand-primary/30 rounded-none overflow-hidden bg-[#05010a] shadow-[0_0_50px_rgba(189,0,255,0.2)]">
        <Canvas className="select-none" shadows>
          {cameraMode === "game" ? (
            <OrthographicCamera
              makeDefault
              position={[0, 20, 0]} // Geändert: Kamera schaut direkt von oben herab
              zoom={80}
              near={0.1}
              far={1000}
            />
          ) : (
            <PerspectiveCamera
              makeDefault
              position={[10, 10, 10]}
              fov={50}
              near={0.1}
              far={1000}
            />
          )}
          <Scene
            buildings={mergedBuildings}
            serverTime={serverTime}
            activeHoverBuildingId={activeHoverBuildingId}
            hoverSuppressed={hoverSuppressed}
            horizontalPanEnabled={isTownCameraHorizontalPanEnabled}
            onPanDebugChange={setTownCameraPanDebug}
            isFreePositionMode={isFreePositionMode}
            onTransform={(id, pos) => {
              setPositionOverrides((prev) => ({ ...prev, [id]: pos }));
            }}
            onBuildingClick={(b) => {
              setActiveHoverBuildingId(null);
              if (b.id === ARENA_BUILDING_ID) {
                setShowArenaModal(true);
                return;
              }
              if (b.id === CASINO_BUILDING_ID) {
                setShowCasinoModal(true);
                return;
              }
              if (b.id === STOCK_EXCHANGE_BUILDING_ID) {
                openCentralManagement({
                  tab: "market",
                  source: "query" as any,
                });
                return;
              }
              setSelectedBuilding(b);
              setEditForm({
                title: b.title || "",
                price: b.price || 5000,
                forSale: b.forSale ?? true,
              });
            }}
            cameraMode={cameraMode}
            freeMoveBuildingId={freeMoveBuildingId}
            onGroundPointerMove={(e) => {
              if (freeMoveBuildingId) {
                e.stopPropagation();
                setFreeMovePosition([e.point.x, e.point.y, e.point.z]);
              }
            }}
            onGroundClick={async (e) => {
              if (freeMoveBuildingId && freeMovePosition) {
                e.stopPropagation();

                const targetBuilding = HARDCODED_BUILDINGS.find(
                  (b) => b.id === freeMoveBuildingId,
                );
                if (targetBuilding) {
                  // Keep original Y (height), only update X and Z from the ground plane click
                  const newPos: [number, number, number] = [
                    freeMovePosition[0],
                    targetBuilding.position[1],
                    freeMovePosition[2],
                  ];
                  const currentRot =
                    rotationOverrides[freeMoveBuildingId] ??
                    targetBuilding.rotationY;

                  setPositionOverrides((prev) => ({
                    ...prev,
                    [freeMoveBuildingId]: newPos,
                  }));
                  await updateBuildingTransform(
                    freeMoveBuildingId,
                    newPos,
                    currentRot,
                  );
                  toast.success("Position saved!");
                }
                setFreeMoveBuildingId(null);
                setFreeMovePosition(null);
              }
            }}
          />
        </Canvas>
        {/*  <LoaderWrapper /> */}

        {/* Overlay HUD elements */}
        {isTownCameraHorizontalPanEnabled &&
          isTownCameraPanDebugEnabled &&
          cameraMode === "dev" && (
            <div className="absolute top-4 left-4 z-40 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-[11px] font-mono text-white backdrop-blur">
              <div>Town Pan Debug</div>
              <div>targetX: {townCameraPanDebug.targetX.toFixed(2)}</div>
              <div>minX: {townCameraPanDebug.minX.toFixed(2)}</div>
              <div>maxX: {townCameraPanDebug.maxX.toFixed(2)}</div>
              <div>rawΔx: {townCameraPanDebug.rawDeltaX.toFixed(2)}</div>
              <div>
                appliedΔx: {townCameraPanDebug.appliedDeltaX.toFixed(2)}
              </div>
              <div>clampHits: {townCameraPanDebug.clampHits}</div>
            </div>
          )}
        {freeMoveBuildingId && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 p-4 bg-yellow-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.5)] z-50 animate-pulse text-center">
            Click anywhere on the ground to place the building
            <Button
              size="sm"
              variant="outline"
              className="mt-2 block mx-auto border-black/20 hover:bg-black/10"
              onClick={() => {
                setFreeMoveBuildingId(null);
                setFreeMovePosition(null);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        {movingBuilding && cameraMode === "dev" ? (
          <div className="absolute bottom-6 left-6 p-4 bg-black/80 backdrop-blur-xl border border-yellow-500/50 rounded-xl pointer-events-auto flex flex-col gap-4 min-w-[200px]">
            <div className="flex justify-between items-center">
              <p className="text-xs text-yellow-500 uppercase font-bold">
                Moving: {movingBuilding.type}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider"
                onClick={() => setMovingBuilding(null)}
              >
                Deselect
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              onClick={() => {
                setFreeMoveBuildingId(movingBuilding.id);
                setMovingBuilding(null);
                toast.info(
                  "Click anywhere on the ground to place the building.",
                );
              }}
            >
              Move House Freely
            </Button>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest flex justify-between">
                Step Size: <span>{stepSize.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={stepSize}
                onChange={(e) => setStepSize(parseFloat(e.target.value))}
                className="w-full accent-yellow-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("z", -1)}
                  aria-label="Move South (Decrease Y)"
                >
                  Y -
                </Button>
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("x", -1)}
                  aria-label="Move West (Decrease X)"
                >
                  X -
                </Button>
                <div className="flex flex-col gap-1 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-12 text-[10px] border-blue-500/30 hover:bg-blue-500/20"
                    onClick={() => handleMove("y", 1)}
                    aria-label="Move Up (Increase Z)"
                  >
                    Z +
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-12 text-[10px] border-blue-500/30 hover:bg-blue-500/20"
                    onClick={() => handleMove("y", -1)}
                    aria-label="Move Down (Decrease Z)"
                  >
                    Z -
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("x", 1)}
                  aria-label="Move East (Increase X)"
                >
                  X +
                </Button>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("z", 1)}
                  aria-label="Move North (Increase Y)"
                >
                  Y +
                </Button>
              </div>
              <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-yellow-500/30">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("rot", -1)}
                  aria-label="Rotate Counter-clockwise"
                >
                  ↺ Rot L
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-yellow-500/30 hover:bg-yellow-500/20"
                  onClick={() => handleMove("rot", 1)}
                  aria-label="Rotate Clockwise"
                >
                  Rot R ↻
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-6 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl pointer-events-none flex flex-col gap-2">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              Navigation Info
            </p>
            <p className="text-xs text-white/80">
              Right-click to rotate • Scroll to zoom
            </p>
            {cameraMode === "dev" && (
              <div className="pointer-events-auto flex flex-col gap-2 mt-2">
                <Button
                  size="sm"
                  variant={isFreePositionMode ? "default" : "outline"}
                  className={`text-xs w-full ${isFreePositionMode ? "bg-brand-primary text-white" : ""}`}
                  onClick={() => setIsFreePositionMode(!isFreePositionMode)}
                >
                  {isFreePositionMode ? "Cancel Free Pos" : "Free Position Mode"}
                </Button>
                {isFreePositionMode && (
                  <Button
                    size="sm"
                    className="text-xs w-full bg-green-500 hover:bg-green-600 text-black font-bold"
                    onClick={async () => {
                      try {
                        const promises = Object.entries(positionOverrides).map(([id, pos]) => 
                          updateBuildingTransform(id, pos, rotationOverrides[id] ?? HARDCODED_BUILDINGS.find(b => b.id === id)?.rotationY ?? 0)
                        );
                        await Promise.all(promises);
                        toast.success("Positions saved successfully!");
                        setIsFreePositionMode(false);
                      } catch (e) {
                        toast.error("Failed to save positions");
                      }
                    }}
                  >
                    Save Positions
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <MarketTickerTape
        onSelectSymbol={(symbol) => {
          openCentralManagement({
            tab: "market",
            symbol,
            source: "ticker",
          });
        }}
      />

      <Dialog
        open={isWalletModalOpen}
        onOpenChange={(open) => {
          setIsWalletModalOpen(open);
          if (!open) {
            requestAnimationFrame(() => {
              walletButtonRef.current?.focus();
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] cyber-panel text-white border-t-4 border-t-brand-secondary rounded-none shadow-[0_0_50px_rgba(255,184,0,0.15)] p-0 overflow-hidden">
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle
                className="text-3xl font-heading font-black italic tracking-tighter text-brand-secondary cyber-glitch-text"
                data-text="YOUR WALLET"
              >
                YOUR WALLET
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">
                Financial Summary // Authorization Confirmed
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 p-6 bg-black/40 border border-white/5 cyber-skew">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">
                    Total Balance
                  </span>
                  <span className="text-3xl font-black italic tracking-tighter text-white">
                    {formatCurrencyAmount(
                      walletSummary.totalBalance,
                      walletSummary.currencyCode,
                    )}
                  </span>
                </div>
                <div className="h-px bg-white/5 w-full" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">
                    Income
                  </span>
                  <span className="text-sm font-mono font-bold text-green-400">
                    {formatCurrencyAmount(
                      walletSummary.income,
                      walletSummary.currencyCode,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">
                    Expenses
                  </span>
                  <span className="text-sm font-mono font-bold text-brand-tertiary">
                    {formatCurrencyAmount(
                      walletSummary.expenses,
                      walletSummary.currencyCode,
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-brand-primary font-black">
                    Activity Breakdown
                  </p>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-gray-600 font-black">
                    Recent Transactions
                  </p>
                </div>
                <ul className="grid gap-2">
                  {walletSummary.categories
                    .filter((category) => category.enabled)
                    .map((category) => (
                      <li
                        key={category.key}
                        className="flex items-center justify-between bg-white/5 border border-white/5 px-4 py-3 cyber-skew group hover:bg-brand-primary/5 hover:border-brand-primary/30 transition-all"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
                          {category.label}
                        </span>
                        <span className="text-sm font-mono font-bold text-white">
                          {formatCurrencyAmount(
                            category.amount,
                            walletSummary.currencyCode,
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
            <Button
              onClick={() => setIsWalletModalOpen(false)}
              className="w-full h-12 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs border border-white/10 rounded-none cyber-skew"
            >
              Close Interface
            </Button>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-50" />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedBuilding}
        onOpenChange={(open) => {
          if (!open) setSelectedBuilding(null);
          else if (selectedBuilding) {
            setEditForm({
              title: selectedBuilding.title || "",
              price: selectedBuilding.price || 5000,
              forSale: selectedBuilding.forSale ?? true,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] cyber-panel text-white border-t-4 border-t-brand-primary rounded-none shadow-[0_0_50px_rgba(189,0,255,0.15)] p-0 overflow-hidden">
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle
                className="text-3xl font-heading font-black italic tracking-tighter text-brand-secondary cyber-glitch-text"
                data-text={selectedBuilding?.title || selectedBuilding?.type}
              >
                {selectedBuilding?.title || selectedBuilding?.type}
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">
                {selectedBuilding?.id === BANK_BUILDING_ID
                  ? "District Infrastructure // Asset node"
                  : selectedBuilding?.ownerId
                    ? selectedBuilding?.name
                    : "Real Estate Registry // Property Data"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6">
              {/* BANK VIEW */}
              {selectedBuilding?.id === BANK_BUILDING_ID && (
                <div className="p-6 bg-brand-primary/5 border border-brand-primary/20 space-y-6 cyber-skew relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent" />
                  <div className="text-center space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary">
                      Bank of BoozedBunnyTown
                    </h3>
                    <p className="text-[9px] text-gray-500 font-mono">
                      Neural Financial Governance
                    </p>
                  </div>
                  <div className="p-4 bg-black/60 border border-white/5 text-center">
                    <span className="text-[8px] uppercase font-black text-gray-600 tracking-[0.4em] block mb-1">
                      MUNICIPAL TREASURY RESERVE
                    </span>
                    <span className="text-4xl font-black italic tracking-tighter text-brand-secondary">
                      ${townData?.bankBalance?.toLocaleString() || 0}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBuilding(null);
                      openCentralManagement({
                        tab: "treasury",
                        source: "bank",
                      });
                    }}
                    className="group relative w-full block"
                  >
                    <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                    <div className="cyber-skew bg-brand-primary px-4 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
                        Building Controls
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* OWNER MANAGEMENT VIEW */}
              {selectedBuilding?.id !== "4" &&
                currentUser &&
                selectedBuilding?.ownerId === currentUser.character.id && (
                  <div className="space-y-4 p-6 bg-white/5 border border-white/10 cyber-skew">
                    <h3 className="text-[10px] uppercase font-black text-brand-primary tracking-[0.2em] mb-4">
                      Property Administration
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="property-title"
                          className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block"
                        >
                          Registry Identifier
                        </label>
                        <input
                          id="property-title"
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm({ ...editForm, title: e.target.value })
                          }
                          className="w-full bg-black/60 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-primary font-mono"
                          placeholder="e.g. My Awesome Shop"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor="property-price"
                            className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block"
                          >
                            Market Valuation ($)
                          </label>
                          <input
                            id="property-price"
                            type="number"
                            value={editForm.price}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                price: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-black/60 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-primary font-mono"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label
                            htmlFor="property-for-sale"
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <input
                              id="property-for-sale"
                              type="checkbox"
                              checked={editForm.forSale}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  forSale: e.target.checked,
                                })
                              }
                              className="accent-brand-primary w-4 h-4 bg-black border-white/10"
                            />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-brand-primary transition-colors">
                              List for Sale
                            </span>
                          </label>
                        </div>
                      </div>
                      <button
                        disabled={isProcessing}
                        onClick={async () => {
                          setIsProcessing(true);
                          try {
                            await updateBuildingSettings(
                              selectedBuilding.id,
                              editForm.title,
                              editForm.price,
                              editForm.forSale,
                            );
                            const res = await fetch(
                              `/api/town/${townId}/state`,
                            );
                            if (res.ok) {
                              const data = await res.json();
                              setDbBuildingStates(data.buildings || []);
                              setTownData(data.town || null);
                            }
                            if (socket) socket.emit("buy_building", { townId }); // Piggyback on this event to refresh
                            toast.success("Property updated!");
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        className="group relative w-full block disabled:opacity-50"
                      >
                        <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                        <div className="cyber-skew bg-brand-primary px-4 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
                            {isProcessing ? "Processing..." : "Save Changes"}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

              {/* NORMAL VIEW (NOT BANK, NOT OWNER) */}
              {selectedBuilding?.id !== "4" &&
                (!currentUser ||
                  selectedBuilding?.ownerId !== currentUser.character?.id) && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-black text-gray-600 tracking-[0.3em]">
                          Owner Info
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedBuilding?.ownerId) {
                                setProfileModalCharacterId(
                                  selectedBuilding.ownerId,
                                );
                                setProfileModalOpen(true);
                              }
                            }}
                            className={`flex items-center gap-3 text-left focus:outline-none ${selectedBuilding?.ownerId ? "hover:opacity-80 transition-opacity cursor-pointer group" : ""}`}
                          >
                            <div className="w-24 h-24 border border-brand-primary/50 bg-black/40 relative overflow-hidden cyber-skew group-hover:border-brand-primary group-hover:shadow-[0_0_15px_rgba(189,0,255,0.4)] transition-all">
                              {selectedBuilding?.ownerId ? (
                                <Image
                                  src={`https://www.boozedbunnytown.com/media/avatars/${selectedBuilding.ownerAvatar}_avatar.webp`}
                                  alt={selectedBuilding.owner || "Owner"}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm font-black italic text-brand-primary">
                                  U
                                </div>
                              )}
                            </div>
                            <span className="text-xl font-black italic tracking-tighter uppercase group-hover:text-brand-primary transition-colors">
                              {selectedBuilding?.owner}
                            </span>
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-black text-gray-600 tracking-[0.3em]">
                          STATUS
                        </span>
                        <p
                          className={`text-[10px] font-black tracking-widest mt-2 px-3 py-1.5 border cyber-skew ${selectedBuilding?.forSale ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-brand-tertiary/50 bg-brand-tertiary/10 text-brand-tertiary"}`}
                        >
                          {selectedBuilding?.forSale
                            ? `For Sale ($${selectedBuilding.price?.toLocaleString()})`
                            : "Not For Sale"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {canViewGeoPosition && (
                        <div className="p-3 bg-white/5 border border-white/5">
                          <span className="text-[8px] uppercase font-black text-gray-500 tracking-[0.4em] block mb-1">
                            Location
                          </span>
                          <p className="font-mono text-[10px] text-brand-primary font-bold">
                            {selectedBuilding?.position
                              ?.map((v) => v.toFixed(1))
                              .join(" : ")}
                          </p>
                        </div>
                      )}
                      {selectedBuilding?.employees !== undefined && (
                        <div className="p-3 bg-white/5 border border-white/5">
                          <span className="text-[8px] uppercase font-black text-gray-500 tracking-[0.4em] block mb-1">
                            UNIT STAFFING
                          </span>
                          <p className="text-[10px] font-black uppercase text-white">
                            {selectedBuilding.employees} Neural Units
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedBuilding?.forSale &&
                      currentUser &&
                      selectedBuilding.price && (
                        <button
                          disabled={
                            isProcessing ||
                            currentUser.character.wallet <
                              selectedBuilding.price
                          }
                          onClick={async () => {
                            setIsProcessing(true);
                            try {
                              await buyBuilding(selectedBuilding.id);
                              const u = await getCurrentUser();
                              setCurrentUser(u);
                              const res = await fetch(
                                `/api/town/${townId}/state`,
                              );
                              if (res.ok) {
                                const data = await res.json();
                                setDbBuildingStates(data.buildings || []);
                                setTownData(data.town || null);
                              }
                              if (socket)
                                socket.emit("buy_building", {
                                  townId,
                                  buildingId: selectedBuilding.id,
                                });
                              toast.success(
                                `Successfully bought ${selectedBuilding.title || selectedBuilding.type}!`,
                              );
                              setSelectedBuilding(null);
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setIsProcessing(false);
                            }
                          }}
                          className="group relative w-full block disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                          <div className="cyber-skew bg-brand-primary px-4 py-5 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
                              {isProcessing
                                ? "Transacting..."
                                : currentUser.character.wallet <
                                    selectedBuilding.price
                                  ? "Insufficient Liquidity"
                                  : `Acquire Asset // $${selectedBuilding.price.toLocaleString()}`}
                            </span>
                          </div>
                        </button>
                      )}
                  </div>
                )}

              {cameraMode === "dev" && (
                <Button
                  onClick={() => {
                    setMovingBuilding(selectedBuilding);
                    setSelectedBuilding(null);
                  }}
                  className="w-full h-10 bg-brand-secondary/10 hover:bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30 font-black uppercase tracking-widest text-[10px] rounded-none cyber-skew"
                >
                  🏗️ Deploy_Transform_Engine
                </Button>
              )}

              <Button
                onClick={() => setSelectedBuilding(null)}
                className="w-full h-10 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white border border-white/10 rounded-none cyber-skew font-black uppercase tracking-widest text-[10px]"
              >
                Close Registry
              </Button>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-50" />
        </DialogContent>
      </Dialog>

      {isChatWhisperEnabled && (
        <TownChatPanel
          socket={socket}
          townId={townId}
          currentUserId={currentUser?.id}
          currentUsername={currentUser?.username}
        />
      )}

      <CombinedMarketView
        socket={socket}
        open={showCombinedView}
        setOpen={(open) => {
          if (!open) {
            closeCentralManagement();
            return;
          }
          setShowCombinedView(true);
        }}
        townData={townData}
        townId={townId}
        intent={marketIntent}
        onIntentConsumed={() => setMarketIntent(null)}
      />

      <PlayerProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        characterId={profileModalCharacterId || ""}
        currentUserId={currentUser?.character?.id}
      />

      <Dialog
        open={showCasinoModal}
        onOpenChange={(open) => setShowCasinoModal(open)}
      >
        <DialogContent className="sm:max-w-[425px] cyber-panel text-white border-t-4 border-t-brand-primary rounded-none shadow-[0_0_50px_rgba(189,0,255,0.15)] p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-scanline z-50" />

          <div className="p-8">
            <DialogHeader className="pt-6">
              <div className="mx-auto w-20 h-20 bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center mb-6 cyber-skew group">
                <Dices className="w-10 h-10 text-brand-primary group-hover:scale-110 transition-transform" />
              </div>
              <DialogTitle
                className="text-3xl font-heading font-black italic tracking-tighter text-center cyber-glitch-text"
                data-text="THE CASINO"
              >
                THE CASINO
              </DialogTitle>
              <DialogDescription className="text-center text-gray-500 font-mono text-[10px] uppercase tracking-[0.2em] mt-2">
                Casino functionality coming soon.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 flex justify-center">
              <Button
                onClick={() => setShowCasinoModal(false)}
                className="w-full h-10 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white border border-white/10 rounded-none cyber-skew font-black uppercase tracking-widest text-[10px]"
              >
                Close Casino
              </Button>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-50" />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showArenaModal}
        onOpenChange={(open) => {
          if (!open) {
            if (matchmakingStatus === "searching") {
              socket?.emit("leave_arena");
            }
            setShowArenaModal(false);
            setMatchmakingStatus("idle");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] cyber-panel text-white border-t-4 border-t-brand-primary rounded-none shadow-[0_0_50px_rgba(189,0,255,0.15)] p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-scanline z-50" />

          <div className="p-8">
            <DialogHeader className="pt-6">
              <div className="mx-auto w-20 h-20 bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center mb-6 cyber-skew group">
                <Swords className="w-10 h-10 text-brand-primary group-hover:scale-110 transition-transform" />
              </div>
              <DialogTitle
                className="text-3xl font-heading font-black italic tracking-tighter text-center cyber-glitch-text"
                data-text="THE ARENA"
              >
                THE ARENA
              </DialogTitle>
              <DialogDescription className="text-center text-gray-500 font-mono text-[10px] uppercase tracking-[0.2em] mt-2">
                {matchmakingStatus === "idle" &&
                  "Combat Authorization: Pending // Target Selection Required"}
                {matchmakingStatus === "searching" &&
                  "Neural Synchronization: Active // Finding Opponent"}
                {matchmakingStatus === "matched" &&
                  "Signal Locked // Initializing Combat Grid"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-8">
              {matchmakingStatus === "idle" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-white/5 cyber-skew flex flex-col items-center text-center group hover:border-brand-secondary/30 transition-colors">
                      <Trophy className="w-6 h-6 text-brand-secondary mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] uppercase font-black text-gray-600 tracking-[0.3em]">
                        Prize Pool
                      </span>
                      <span className="text-sm font-black italic text-brand-secondary">
                        1,000 BBT
                      </span>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/5 cyber-skew flex flex-col items-center text-center group hover:border-brand-primary/30 transition-colors">
                      <div className="w-6 h-6 flex items-center justify-center mb-2">
                        <span className="text-brand-primary font-black italic">
                          1v1
                        </span>
                      </div>
                      <span className="text-[8px] uppercase font-black text-gray-600 tracking-[0.3em]">
                        Practice Mode
                      </span>
                      <span className="text-sm font-black italic text-white">
                        SURVIVOR
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMatchmakingStatus("matched");
                      socket?.emit("join_singleplayer_arena");
                    }}
                    className="group relative w-full block"
                  >
                    <div className="absolute inset-0 bg-white/5 blur group-hover:bg-white/10 transition-all" />
                    <div className="cyber-skew bg-white/5 border border-white/10 px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-white transition-colors">
                        Solo Play
                      </span>
                    </div>
                  </button>

                  {process.env.NODE_ENV !== "production" && (
                    <button
                      onClick={() => {
                        router.push("/arena/dev-room?devMode=true");
                      }}
                      className="group relative w-full block"
                    >
                      <div className="absolute inset-0 bg-yellow-500/20 blur group-hover:bg-yellow-500/40 transition-all" />
                      <div className="cyber-skew bg-yellow-500/10 border border-yellow-500/30 px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500 transition-colors">
                          Arena DevMode
                        </span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMatchmakingStatus("searching");
                      socket?.emit("join_arena");
                    }}
                    className="group relative w-full block"
                  >
                    <div className="absolute inset-0 bg-brand-primary/20 blur group-hover:bg-brand-primary/40 transition-all" />
                    <div className="cyber-skew bg-brand-primary px-6 py-4 relative transition-all group-hover:translate-x-1 group-hover:-translate-y-1 text-center">
                      <span className="text-sm font-black uppercase tracking-[0.2em] text-white">
                        Enter Arena
                      </span>
                    </div>
                  </button>
                  <div className="mt-8">
                    <ArenaGlobalToplist
                      currentUserUsername={currentUser?.username}
                    />
                  </div>
                </div>
              )}

              {matchmakingStatus === "searching" && (
                <div className="flex flex-col items-center justify-center py-4 space-y-8">
                  <div className="relative">
                    <div className="w-32 h-32 border-2 border-brand-primary/20 rounded-none cyber-skew animate-ping absolute" />
                    <div className="w-32 h-32 border-t-2 border-brand-primary rounded-none cyber-skew animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-brand-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-6">
                      <div className="w-10 h-10 border border-brand-primary bg-brand-primary/20 flex items-center justify-center cyber-skew">
                        <span className="text-brand-primary font-black italic text-xs">
                          YOU
                        </span>
                      </div>
                      <div className="w-16 h-1 bg-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-primary animate-scanline" />
                      </div>
                      <div className="w-10 h-10 border border-white/10 bg-white/5 flex items-center justify-center cyber-skew">
                        <span className="text-gray-600 font-black italic text-xs">
                          ?
                        </span>
                      </div>
                    </div>
                    <p className="text-brand-primary font-mono text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
                      Looking for match...
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      socket?.emit("leave_arena");
                      setMatchmakingStatus("idle");
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-brand-tertiary transition-colors"
                  >
                    [ Cancel ]
                  </button>
                </div>
              )}

              {matchmakingStatus === "matched" && (
                <div className="flex flex-col items-center justify-center py-4 space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-brand-primary border-2 border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(189,0,255,0.4)] cyber-skew">
                        <span className="text-white font-black italic text-2xl">
                          YOU
                        </span>
                      </div>
                    </div>
                    <div className="text-4xl font-black italic text-brand-secondary tracking-tighter animate-pulse">
                      VS
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-brand-secondary border-2 border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,184,0,0.4)] cyber-skew">
                        <span className="text-black font-black italic text-2xl">
                          OPP
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 px-8 py-4 cyber-skew relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-500/5 animate-pulse" />
                    <p className="text-green-400 font-black uppercase tracking-[0.3em] text-sm flex items-center gap-3">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                      Match Found!
                    </p>
                  </div>
                  <p className="text-gray-600 text-[10px] uppercase font-black tracking-[0.5em] animate-pulse">
                    Entering in 2s...
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-50" />
        </DialogContent>
      </Dialog>
    </main>
  );
}
