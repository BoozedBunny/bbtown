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
import { ModelBuilding } from "@/components/ModelBuilding";
import { ModelX } from "@/components/ModelX";
import { TexturedGround } from "@/components/TexturedGround";
import { RoadTile } from "@/components/RoadTile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "../../actions/user";
import { buyBuilding } from "../../actions/town";
import { updateBuildingPosition } from "../../actions/dev";

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
    position: [-0.6, 0.9, -2],
    rotationY: 80,
    glb: "/models/rustic_stein.glb",
    type: "Town Hall",
    color: "#BD00FF",
  },
  {
    id: "2",
    position: [3, 0.9, 0.8],
    rotationY: 50,
    glb: "/models/barbys_house.glb",
    type: "Residential",
    color: "#FFB800",
  },
  {
    id: "3",
    position: [-3, 0.9, 1],
    rotationY: 30,
    glb: "/models/bb_house_fin.glb",
    type: "Industrial",
    color: "#FF4D00",
  },
  {
    id: "4",
    position: [1.5, 0.9, -5],
    rotationY: 10,
    glb: "/models/clocktower_fin.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "5",
    position: [5.5, 0.9, -3.2],
    rotationY: -20,
    glb: "/models/massage_saloon.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "6",
    position: [-2.8, 0.9, -4],
    rotationY: 80,
    glb: "/models/tower.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
  {
    id: "7",
    position: [-3, 0.97, -2.6],
    rotationY: 50,
    glb: "/models/bb_gogo_bar.glb",
    type: "Commercial",
    color: "#BD00FF",
  },
];


function Scene({
  buildings,
  isXRay,
  onBuildingClick,
  cameraMode,
}: {
  buildings: BuildingData[];
  isXRay: boolean;
  onBuildingClick: (b: BuildingData) => void;
  cameraMode: "game" | "dev";
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Dein neues Bild als Boden */}
      <TexturedGround url="/textures/ground.png" />

      {/* <gridHelper args={[30, 30, "#BD00FF", "#2A0A4E"]} position={[0, 0.02, 0]}>
         <meshBasicMaterial transparent opacity={0.2} />
      </gridHelper> */}

      {buildings.map((b) => {
        return (
          <ModelBuilding
            key={b.id}
            url={b.glb!}
            position={b.position}
            opacity={!isXRay ? 1 : 0.4}
            rotationY={b.rotationY || 0}
            onClick={() => onBuildingClick(b)}
          />
        );
      })}

      <ModelX
        url="/models/bbtown_logo_optimized.glb"
        position={[5.9, 0.69, 5.5]}
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
      <Environment preset="night" />
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(
    null,
  );
  const [isXRay, setIsXRay] = useState(false);
  const [cameraMode, setCameraMode] = useState<"game" | "dev">("game");
  const [movingBuilding, setMovingBuilding] = useState<BuildingData | null>(null);
  const [stepSize, setStepSize] = useState<number>(0.5);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, [number, number, number]>>({});
  const [dbBuildingStates, setDbBuildingStates] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleMove = async (axis: 'x' | 'y' | 'z', dir: 1 | -1) => {
    if (!movingBuilding) return;
    const currentPos = positionOverrides[movingBuilding.id] || movingBuilding.position;
    const newPos: [number, number, number] = [...currentPos];
    if (axis === 'x') newPos[0] += dir * stepSize;
    if (axis === 'y') newPos[1] += dir * stepSize;
    if (axis === 'z') newPos[2] += dir * stepSize;
    
    setPositionOverrides(prev => ({ ...prev, [movingBuilding.id]: newPos }));
    setMovingBuilding({ ...movingBuilding, position: newPos });
    
    // Update the hardcoded file
    await updateBuildingPosition(movingBuilding.id, newPos);
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
          setDbBuildingStates(data);
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

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [townId]);

  const mergedBuildings = useMemo(() => {
    return HARDCODED_BUILDINGS.map((b) => {
      const pos = positionOverrides[b.id] || b.position;

      const dbState = dbBuildingStates.find((ds) => ds.id === b.id);
      if (dbState) {
        return {
          position: pos,
          ...b,
          owner: dbState.owner?.name || "Unowned",
          ownerId: dbState.ownerId,
          price: dbState.price,
          employees: dbState.employees,
        };
      }
      return { ...b, position: pos };
    });
  }, [dbBuildingStates]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-brand-neutral text-white font-sans overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary opacity-10 blur-[120px] rounded-full" />

      <div className="z-10 w-full max-w-6xl flex justify-between items-center mb-8 bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-white flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-primary rounded-lg rotate-12" />
            BoozedBunnyTown{" "}
            <span className="text-brand-secondary">#{townId}</span>
          </h1>
          <div className="flex gap-4">
            <p className="text-gray-400 text-sm mt-1">
              Coordinate your isometric empire
            </p>
            {currentUser && currentUser.character && (
              <div className="bg-brand-primary/20 px-3 py-1 rounded-full border border-brand-primary/50 flex items-center gap-2">
                <span className="text-brand-secondary font-bold text-sm">💰 ${currentUser.character.wallet.toLocaleString()}</span>
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
            onBuildingClick={setSelectedBuilding}
            cameraMode={cameraMode}
          />
        </Canvas>

        {/* Overlay HUD elements */}
        {movingBuilding && cameraMode === "dev" ? (
          <div className="absolute bottom-6 left-6 p-4 bg-black/80 backdrop-blur-xl border border-yellow-500/50 rounded-xl pointer-events-auto flex flex-col gap-4 min-w-[200px]">
            <div className="flex justify-between items-center">
              <p className="text-xs text-yellow-500 uppercase font-bold">
                Moving: {movingBuilding.type}
              </p>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider" onClick={() => setMovingBuilding(null)}>
                Deselect
              </Button>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest flex justify-between">
                Step Size: <span>{stepSize.toFixed(1)}</span>
              </label>
              <input type="range" min="0.1" max="5" step="0.1" value={stepSize} onChange={(e) => setStepSize(parseFloat(e.target.value))} className="w-full accent-yellow-500" />
            </div>

            <div className="flex flex-col gap-2">
               <div className="flex justify-center gap-2">
                 <Button size="sm" variant="outline" className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => handleMove('z', -1)}>Z -</Button>
               </div>
               <div className="flex justify-between gap-2">
                 <Button size="sm" variant="outline" className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => handleMove('x', -1)}>X -</Button>
                 <div className="flex flex-col gap-1 items-center">
                    <Button size="sm" variant="outline" className="h-6 w-12 text-[10px] border-blue-500/30 hover:bg-blue-500/20" onClick={() => handleMove('y', 1)}>Y +</Button>
                    <Button size="sm" variant="outline" className="h-6 w-12 text-[10px] border-blue-500/30 hover:bg-blue-500/20" onClick={() => handleMove('y', -1)}>Y -</Button>
                 </div>
                 <Button size="sm" variant="outline" className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => handleMove('x', 1)}>X +</Button>
               </div>
               <div className="flex justify-center gap-2">
                 <Button size="sm" variant="outline" className="w-12 text-xs border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => handleMove('z', 1)}>Z +</Button>
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
        onOpenChange={(open) => !open && setSelectedBuilding(null)}
      >
        <DialogContent className="sm:max-w-[425px] bg-[#11041d] text-white border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-brand-secondary">
              {selectedBuilding?.type}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Infrastructure Analysis
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                  Ownership
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-xs font-bold">
                    {selectedBuilding?.owner?.charAt(0)}
                  </div>
                  <span className="text-lg font-medium">
                    {selectedBuilding?.owner}
                  </span>
                </div>
              </div>
              {selectedBuilding?.price && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                    Value
                  </span>
                  <p className="text-lg font-bold text-brand-secondary">
                    ${selectedBuilding.price.toLocaleString()}
                  </p>
                </div>
              )}
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

            <div className="mt-2 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
              <p className="text-sm text-gray-400 italic leading-relaxed">
                "The {selectedBuilding?.type.toLowerCase()} module is operating
                at peak efficiency within the BoozedBunnyTown network."
              </p>
            </div>
            
            {selectedBuilding?.owner === "Unowned" && currentUser && selectedBuilding.price && currentUser.character.wallet >= selectedBuilding.price && (
              <Button
                onClick={async () => {
                  try {
                    await buyBuilding(selectedBuilding.id);
                    // Refresh user and building state
                    const u = await getCurrentUser();
                    setCurrentUser(u);
                    const res = await fetch(`/api/town/${townId}/state`);
                    if (res.ok) setDbBuildingStates(await res.json());
                    if (socket) socket.emit("buy_building", { townId, buildingId: selectedBuilding.id });
                    setSelectedBuilding(null);
                  } catch (e) {
                    alert(e);
                  }
                }}
                className="w-full bg-brand-primary hover:bg-brand-primary/80 font-bold"
              >
                Buy for ${selectedBuilding.price.toLocaleString()}
              </Button>
            )}

            {cameraMode === "dev" && (
              <Button
                onClick={() => {
                  setMovingBuilding(selectedBuilding);
                  setSelectedBuilding(null);
                }}
                className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold"
              >
                🏗️ Move House (Dev Only)
              </Button>
            )}

            <Button
              onClick={() => setSelectedBuilding(null)}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Close Report
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
