"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  OrthographicCamera,
} from "@react-three/drei";
import { useEffect, useState, use } from "react";
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

interface BuildingData {
  id: string;
  position: [number, number, number];
  rotationY: number;
  glb?: string;
  type: string;
  owner?: string;
  color?: string;
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
    owner: "Mayor",
    color: "#BD00FF",
  },
  {
    id: "2",
    position: [3, 0.9, 0.8],
    rotationY: 50,
    glb: "/models/barbys_house.glb",
    type: "Residential",
    owner: "Alice",
    color: "#FFB800",
  },
  {
    id: "3",
    position: [-3, 0.9, 1],
    rotationY: 30,
    glb: "/models/bb_house_fin.glb",
    type: "Industrial",
    owner: "Bob",
    color: "#FF4D00",
  },
  {
    id: "4",
    position: [1.5, 0.9, -5],
    rotationY: 10,
    glb: "/models/clocktower_fin.glb",
    type: "Commercial",
    owner: "Charlie",
    color: "#BD00FF",
  },
  {
    id: "5",
    position: [5.5, 0.9, -3.2],
    rotationY: -20,
    glb: "/models/massage_saloon.glb",
    type: "Commercial",
    owner: "Woop",
    color: "#BD00FF",
  },
  {
    id: "6",
    position: [-2, 0.9, -4.3],
    rotationY: 80,
    glb: "/models/tower.glb",
    type: "Commercial",
    owner: "Woop",
    color: "#BD00FF",
  },
];

function Scene({
  buildings,
  isXRay,
  onBuildingClick,
}: {
  buildings: BuildingData[];
  isXRay: boolean;
  onBuildingClick: (b: BuildingData) => void;
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
        if (b.type === "road") {
          return (
            <RoadTile
              key={b.id}
              position={b.position}
              rotationY={b.rotationY}
            />
          );
        }
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
        position={[2, 0.9, 5]}
        opacity={!isXRay ? 1 : 0.5}
        rotationY={20}
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
        enablePan={true}
        enableRotate={true}
        zoomSpeed={0.5}
        minZoom={10}
        maxZoom={100}
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

  useEffect(() => {
    const socketInstance = io();

    socketInstance.on("connect", () => {
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

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
          <p className="text-gray-400 text-sm mt-1">
            Coordinate your isometric empire
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            onClick={() => setIsXRay(!isXRay)}
            className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-all border ${isXRay ? "bg-brand-primary/20 border-brand-primary text-brand-primary" : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}
          >
            {isXRay ? "X-Ray Active" : "X-Ray View"}
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
          <OrthographicCamera
            makeDefault
            position={[10, 10, 10]}
            zoom={45}
            near={0.1}
            far={1000}
          />
          <Scene
            buildings={HARDCODED_BUILDINGS}
            isXRay={isXRay}
            onBuildingClick={setSelectedBuilding}
          />
        </Canvas>

        {/* Overlay HUD elements */}
        <div className="absolute bottom-6 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl pointer-events-none">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
            Navigation Info
          </p>
          <p className="text-xs text-white/80">
            Right-click to rotate • Scroll to zoom
          </p>
        </div>
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
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                Geo-Position
              </span>
              <p className="font-mono text-brand-primary">
                {selectedBuilding?.position
                  ?.map((v) => v.toFixed(1))
                  .join(", ")}
              </p>
            </div>
            <div className="mt-2 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
              <p className="text-sm text-gray-400 italic leading-relaxed">
                "The {selectedBuilding?.type.toLowerCase()} module is operating
                at peak efficiency within the BoozedBunnyTown network."
              </p>
            </div>
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
