"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useEffect, useState, use, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Swords, Trophy, Loader2, X } from "lucide-react";
import { ModelBuilding } from "@/components/ModelBuilding";
import { ModelX } from "@/components/ModelX";
import { TexturedGround } from "@/components/TexturedGround";
import { DayNightCycle } from "@/components/DayNightCycle";
import { RoadTile } from "@/components/RoadTile";
import { CombinedMarketView } from "@/components/CombinedMarketView";
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

interface BuildingData {
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
}

const createRoads = () => {
  const roads: BuildingData[] = [];

  // Horizontale Hauptstraße (X von -10 bis 10)
  for (let x = -10; x <= 10; x++) {
    roads.push({
      id: `r-h-${x}`,
      type: "road",
      position: [x, 0, 0],
      rotationY: 0,
    });
  }

  // Vertikale Seitenstraße 1 (Z von -10 bis 10 bei X = -4)
  for (let z = -10; z <= 10; z++) {
    roads.push({
      id: `r-v1-${z}`,
      type: "road",
      position: [-4, 0, z],
      rotationY: 90,
    });
  }

  // Vertikale Seitenstraße 2 (Z von -10 bis 10 bei X = 4)
  for (let z = -10; z <= 10; z++) {
    roads.push({
      id: `r-v2-${z}`,
      type: "road",
      position: [4, 0, z],
      rotationY: 90,
    });
  }

  return roads;
};

const HARDCODED_BUILDINGS: BuildingData[] = [
  {
    id: "1",
    position: [-1.00, 0.90, -0.57],
    rotationY: 80,
    glb: "/models/rustic_stein.glb",
    type: "Town Hall",
    color: "#BD00FF",
  },
  {
    id: "2",
    position: [-1.12, 0.90, -5.49],
    rotationY: -142,
    glb: "/models/barbys_house.glb",
    type: "Residential",
    color: "#FFB800",
  },
  {
    id: "3",
    position: [-2.71, 0.90, 1.68],
    rotationY: 98,
    glb: "/models/bb_house_fin.glb",
    type: "Industrial",
    color: "#FF4D00",
  },
  {
    id: "4",
    position: [-3.30, 0.90, -1.35],
    rotationY: 47,
    glb: "/models/clocktower_fin.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "5",
    position: [6.06, 0.90, -2.02],
    rotationY: -40,
    glb: "/models/massage_saloon.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "6",
    position: [7.80, 0.90, 2.00],
    rotationY: 80,
    glb: "/models/tower.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "7",
    position: [-5.33, 0.97, -4.20],
    rotationY: 50,
    glb: "/models/bb_gogo_bar.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "8",
    position: [1.07, 0.97, 5.75],
    rotationY: 147,
    glb: "/models/1001_nights.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "9",
    position: [-2.65, 0.97, -7.43],
    rotationY: 50,
    glb: "/models/akihabara.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "10",
    position: [1.56, 0.97, -9.05],
    rotationY: 88,
    glb: "/models/boat_house.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "11",
    position: [7.80, 0.97, -0.30],
    rotationY: 13,
    glb: "/models/dune_partyhouse.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "12",
    position: [-0.00, 0.97, -5.21],
    rotationY: 50,
    glb: "/models/feet_house.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "13",
    position: [-8.01, 0.97, -0.99],
    rotationY: 50,
    glb: "/models/holy_rave.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "14",
    position: [9.51, 0.97, -5.98],
    rotationY: 26,
    glb: "/models/hoppy_heaven.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "15",
    position: [-11.45, 0.97, -5.20],
    rotationY: 28,
    glb: "/models/pipe_house.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "16",
    position: [-2.4, 2.67, 4.0],
    rotationY: 105,
    glb: "/models/up_up_balloon.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "17",
    position: [-0.59, 0.97, 3.69],
    rotationY: 125,
    glb: "/models/up_up_house.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "18",
    position: [9.79, 0.97, -1.91],
    rotationY: 24,
    glb: "/models/vino_vibes.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "19",
    position: [4.27, 0.97, -5.56],
    rotationY: 50,
    glb: "/models/vodka_palace.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "20",
    position: [3.21, 0.97, 0.92],
    rotationY: 41,
    glb: "/models/vulcan_temple.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "21",
    position: [1.72, 0.57, -2.16],
    rotationY: 0,
    glb: "/models/arena-v2.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
];

function Scene({
  buildings,
  isXRay,
  onBuildingClick,
  cameraMode,
  freeMoveBuildingId,
  onGroundPointerMove,
  onGroundClick,
  serverTime,
}: {
  buildings: BuildingData[];
  isXRay: boolean;
  onBuildingClick: (b: BuildingData) => void;
  cameraMode: "game" | "dev";
  freeMoveBuildingId?: string | null;
  onGroundPointerMove?: (e: any) => void;
  onGroundClick?: (e: any) => void;
  serverTime?: string;
}) {
  return (
    <>
      <DayNightCycle serverTime={serverTime} />

      {/* Dein neues Bild als Boden */}
      <TexturedGround
        url="/textures/testground.png"
        onPointerMove={onGroundPointerMove}
        onClick={onGroundClick}
      />

      {/* <gridHelper args={[30, 30, "#BD00FF", "#2A0A4E"]} position={[0, 0.02, 0]}>
         <meshBasicMaterial transparent opacity={0.2} />
      </gridHelper> */}

      {buildings.map((b) => {
        const isXRayActive = isXRay || freeMoveBuildingId === b.id;

        return (
          <ModelBuilding
            key={b.id}
            url={b.glb!}
            position={b.position}
            opacity={!isXRayActive ? 1 : 0.4}
            rotationY={b.rotationY || 0}
            onClick={() => {
              if (!freeMoveBuildingId) onBuildingClick(b);
            }}
          />
        );
      })}

      <ModelX
        url="/models/bbtown_logo_optimized.glb"
        position={[6, 0.69, 4.1]}
        opacity={!isXRay ? 1 : 0.5}
        rotationY={50}
        tiltX={-76}
        tiltZ={70}
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={30}
        blur={2}
        far={1}
      />
      <OrbitControls
        enablePan={cameraMode === "dev"}
        enableRotate={true}
        zoomSpeed={0.5}
        minZoom={cameraMode === "game" ? 80 : 0.1}
        maxZoom={cameraMode === "game" ? 120 : 1000}
        minPolarAngle={cameraMode === "game" ? Math.PI / 3.5 : 0}
        maxPolarAngle={cameraMode === "game" ? Math.PI / 2.9 : Math.PI}
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(
    null,
  );
  const [isXRay, setIsXRay] = useState(false);
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
  const [dbBuildingStates, setDbBuildingStates] = useState<any[]>([]);
  const [townData, setTownData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverTime, setServerTime] = useState<string | undefined>(undefined);
  const [showCombinedView, setShowCombinedView] = useState(false);
  const [showArenaModal, setShowArenaModal] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<"idle" | "searching" | "matched">("idle");
  const [editForm, setEditForm] = useState({
    title: "",
    price: 5000,
    forSale: false,
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        setLoadingProgress(progress);
        clearInterval(interval);
        setTimeout(() => setShowLoading(false), 600);
      } else {
        setLoadingProgress(progress);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

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
      toast.success("Match Found! Entering Arena...");
      setTimeout(() => {
        router.push(`/arena/${gameRoomId}`);
      }, 2000);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [townId]);

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
          ownerId: dbState.ownerId,
          price: dbState.price,
          title: dbState.title,
          forSale: dbState.forSale,
          employees: dbState.employees,
        };
      }
      return { ...b, position: pos, rotationY: rot };
    });
  }, [dbBuildingStates]);

  if (showLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center text-white font-sans overflow-hidden relative brand-bg-overlay">
        <div className="z-10 flex flex-col items-center max-w-sm w-full glass-card p-8">
          <div className="relative w-24 h-24 mb-6 animate-pulse">
            <Image
              src="/logo.png"
              alt="BoozedBunny Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(189,0,255,0.5)]"
            />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2 text-center brand-gradient-text">
            Entering City...
          </h2>
          <p className="text-gray-400 text-sm mb-8 text-center">
            Simulating economics and loading assets
          </p>

          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="w-full flex justify-between mt-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
              Progress
            </span>
            <span className="text-xs text-brand-secondary font-bold">
              {loadingProgress}%
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-white font-sans overflow-hidden relative brand-bg-overlay">
      <div className="z-10 w-full max-w-6xl flex justify-between items-center mb-8 glass-card p-6 shadow-xl">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-white flex items-center gap-3">
            <button
              className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 -m-1"
              onClick={() => setShowCombinedView(true)}
              aria-label="Open Town Central Management"
            >
              <div className="relative w-8 h-8">
                <Image
                  src="/logo.png"
                  alt="BB"
                  fill
                  className="object-contain"
                />
              </div>
              <span>
                BoozedBunnyTown{" "}
                <span className="text-brand-secondary">#{townId}</span>
              </span>
            </button>
          </h1>
          <div className="flex gap-4">
            <p className="text-gray-400 text-sm mt-1">
              Coordinate your isometric empire
            </p>
            {currentUser && currentUser.character && (
              <div className="bg-brand-primary/20 px-3 py-1 rounded-full border border-brand-primary/50 flex items-center gap-2">
                <span className="text-brand-secondary font-bold text-sm">
                  💰 ${currentUser.character.wallet.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            onClick={() => setIsXRay(!isXRay)}
            className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all border ${isXRay ? "bg-brand-primary/20 border-brand-primary text-brand-primary" : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}
          >
            {isXRay ? "X-Ray Active" : "X-Ray View"}
          </Button>
          <Button
            variant={cameraMode === "dev" ? "default" : "outline"}
            onClick={() =>
              setCameraMode(cameraMode === "game" ? "dev" : "game")
            }
            className="text-xs"
          >
            {cameraMode === "game" ? "Dev Mode" : "Game Mode"}
          </Button>
          <div className="flex flex-col items-end">
            <div
              className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] ${connected ? "text-green-400" : "text-red-400"}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
              />
              {connected ? "Live System" : "Offline"}
            </div>
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
      </div>

      <div className="relative w-full h-[75vh] border border-white/10 rounded-3xl overflow-hidden bg-[#05010a] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <Canvas shadows>
          {cameraMode === "game" ? (
            <OrthographicCamera
              makeDefault
              position={[10, 10, 10]}
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
            isXRay={isXRay}
            serverTime={serverTime}
            onBuildingClick={(b) => {
              if (b.id === "21") {
                setShowArenaModal(true);
                return;
              }
              setSelectedBuilding(b);
              setEditForm({
                title: (b as any).title || "",
                price: b.price || 5000,
                forSale: (b as any).forSale ?? true,
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

        {/* Overlay HUD elements */}
                {freeMoveBuildingId && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 p-4 bg-yellow-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.5)] z-50 animate-pulse text-center">
            Click anywhere on the ground to place the building
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-2 block mx-auto border-black/20 hover:bg-black/10" 
              onClick={() => { setFreeMoveBuildingId(null); setFreeMovePosition(null); }}
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
                toast.info("Click anywhere on the ground to place the building.");
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
          <div className="absolute bottom-6 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl pointer-events-none">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              Navigation Info
            </p>
            <p className="text-xs text-white/80">
              Right-click to rotate • Scroll to zoom
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedBuilding}
        onOpenChange={(open) => {
          if (!open) setSelectedBuilding(null);
          else if (selectedBuilding) {
            setEditForm({
              title: (selectedBuilding as any).title || "",
              price: selectedBuilding.price || 5000,
              forSale: (selectedBuilding as any).forSale ?? true,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-[#11041d] text-white border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-brand-secondary">
              {(selectedBuilding as any)?.title || selectedBuilding?.type}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedBuilding?.id === "4"
                ? "Town Infrastructure"
                : "Real Estate Information"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* BANK VIEW */}
            {selectedBuilding?.id === "4" && (
              <div className="p-6 bg-brand-primary/10 rounded-2xl border border-brand-primary/20 text-center space-y-4">
                <h3 className="text-xl font-bold text-white">
                  Bank of BoozedBunnyTown
                </h3>
                <p className="text-sm text-gray-400">
                  Securing the financial future of our citizens.
                </p>
                <div className="p-4 bg-black/40 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">
                    Town Treasury
                  </span>
                  <span className="text-3xl font-bold text-brand-secondary">
                    ${townData?.bankBalance?.toLocaleString() || 0}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    setSelectedBuilding(null);
                    setShowCombinedView(true);
                  }}
                  className="w-full bg-brand-primary hover:bg-brand-primary/80 mt-4"
                >
                  View Central Management
                </Button>
              </div>
            )}

            {/* OWNER MANAGEMENT VIEW */}
            {selectedBuilding?.id !== "4" &&
              currentUser &&
              selectedBuilding?.ownerId === currentUser.character.id && (
                <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="text-sm uppercase font-bold text-gray-400 tracking-widest mb-4">
                    Manage Property
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="property-title" className="text-xs text-gray-400 block mb-1">
                        Property Title
                      </label>
                      <input
                        id="property-title"
                        type="text"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm({ ...editForm, title: e.target.value })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                        placeholder="e.g. My Awesome Shop"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label htmlFor="property-price" className="text-xs text-gray-400 block mb-1">
                          Sale Price ($)
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
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div className="flex items-end">
                        <label htmlFor="property-for-sale" className="flex items-center gap-2 cursor-pointer mb-2">
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
                            className="accent-brand-primary w-4 h-4"
                          />
                          <span className="text-sm font-medium">For Sale</span>
                        </label>
                      </div>
                    </div>
                    <Button
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
                          const res = await fetch(`/api/town/${townId}/state`);
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
                      className="w-full bg-brand-primary hover:bg-brand-primary/80 disabled:opacity-50"
                    >
                      {isProcessing ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}

            {/* NORMAL VIEW (NOT BANK, NOT OWNER) */}
            {selectedBuilding?.id !== "4" &&
              (!currentUser ||
                selectedBuilding?.ownerId !== currentUser.character?.id) && (
                <>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                        Ownership
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-xs font-bold">
                          {selectedBuilding?.owner?.charAt(0) || "U"}
                        </div>
                        <span className="text-lg font-medium">
                          {selectedBuilding?.owner}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                        Status
                      </span>
                      <p
                        className={`text-sm font-bold mt-1 px-2 py-1 rounded-md ${(selectedBuilding as any)?.forSale ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                      >
                        {(selectedBuilding as any)?.forSale
                          ? `FOR SALE ($${selectedBuilding.price?.toLocaleString()})`
                          : "NOT FOR SALE"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                        Geo-Position
                      </span>
                      <p className="font-mono text-xs text-brand-primary">
                        {selectedBuilding?.position
                          ?.map((v) => v.toFixed(1))
                          .join(", ")}
                      </p>
                    </div>
                    {selectedBuilding?.employees !== undefined && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                          Staffing
                        </span>
                        <p className="text-xs font-medium">
                          {selectedBuilding.employees} Employees
                        </p>
                      </div>
                    )}
                  </div>

                  {(selectedBuilding as any)?.forSale &&
                    currentUser &&
                    selectedBuilding.price && (
                      <Button
                        disabled={isProcessing || currentUser.character.wallet < selectedBuilding.price}
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
                        className="w-full bg-brand-primary hover:bg-brand-primary/80 font-bold disabled:opacity-50"
                      >
                        {isProcessing ? "Processing..." :
                         currentUser.character.wallet < selectedBuilding.price ?
                         "Insufficient Funds" :
                         `Buy Property for $${selectedBuilding.price.toLocaleString()}`}
                      </Button>
                    )}
                </>
              )}

            {cameraMode === "dev" && (
              <Button
                onClick={() => {
                  setMovingBuilding(selectedBuilding);
                  setSelectedBuilding(null);
                }}
                className="w-full mt-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold"
              >
                🏗️ Move House (Dev Only)
              </Button>
            )}

            <Button
              onClick={() => setSelectedBuilding(null)}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CombinedMarketView
        socket={socket}
        open={showCombinedView}
        setOpen={setShowCombinedView}
        townData={townData}
      />

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
        <DialogContent className="sm:max-w-[425px] bg-[#0F021A] text-white border-brand-primary/20 rounded-3xl shadow-[0_0_50px_rgba(189,0,255,0.15)] overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary animate-gradient-x" />

          <DialogHeader className="pt-6">
            <div className="mx-auto w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-brand-primary/20">
              <Swords className="w-8 h-8 text-brand-primary" />
            </div>
            <DialogTitle className="text-3xl font-heading font-bold text-center bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              The Battle Arena
            </DialogTitle>
            <DialogDescription className="text-center text-gray-400">
              {matchmakingStatus === "idle" && "Challenge other players in a 1v1 Wipeout-style showdown."}
              {matchmakingStatus === "searching" && "Finding a worthy opponent..."}
              {matchmakingStatus === "matched" && "Opponent Found! Preparing for battle."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-8">
            {matchmakingStatus === "idle" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                    <Trophy className="w-6 h-6 text-brand-secondary mb-2" />
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Rewards</span>
                    <span className="text-sm font-bold text-brand-secondary">1,000 BBT</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                    <div className="w-6 h-6 flex items-center justify-center mb-2">
                      <span className="text-brand-primary font-bold">1v1</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Mode</span>
                    <span className="text-sm font-bold">Survivor</span>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setMatchmakingStatus("matched");
                    socket?.emit("join_singleplayer_arena");
                  }}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 text-white font-bold text-lg rounded-2xl border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Enter Singleplayer
                </Button>
                <Button
                  onClick={() => {
                    setMatchmakingStatus("searching");
                    socket?.emit("join_arena");
                  }}
                  className="w-full h-14 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(189,0,255,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Enter the Battle
                </Button>
              </div>
            )}

            {matchmakingStatus === "searching" && (
              <div className="flex flex-col items-center justify-center py-4 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-brand-primary/20 rounded-full animate-ping absolute" />
                  <div className="w-24 h-24 border-t-4 border-brand-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-brand-primary animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-brand-primary font-bold text-xs">YOU</span>
                    </div>
                    <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary animate-loading-bar" />
                    </div>
                    <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <span className="text-gray-600 font-bold text-xs">?</span>
                    </div>
                  </div>
                  <p className="text-brand-primary font-mono text-sm animate-pulse">SEARCHING QUEUE...</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    socket?.emit("leave_arena");
                    setMatchmakingStatus("idle");
                  }}
                  className="text-gray-500 hover:text-white hover:bg-white/5 rounded-xl"
                >
                  Cancel Matchmaking
                </Button>
              </div>
            )}

            {matchmakingStatus === "matched" && (
              <div className="flex flex-col items-center justify-center py-4 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(189,0,255,0.4)]">
                      <span className="text-white font-bold text-xl">YOU</span>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-brand-secondary italic">VS</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-brand-secondary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,184,0,0.4)]">
                      <span className="text-white font-bold text-xl">OPP</span>
                    </div>
                  </div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 px-6 py-3 rounded-2xl">
                  <p className="text-green-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                    MATCH CONFIRMED
                  </p>
                </div>
                <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">Teleporting in 2s...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
