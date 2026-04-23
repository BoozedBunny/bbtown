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
import { Building } from "@/components/Building";
import { ModelBuilding } from "@/components/ModelBuilding";
import { ModelX } from "@/components/ModelX";
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
    roads.push({ id: `r-h-${x}`, type: "road", position: [x, 0, 0], rotationY: 0 });
  }
  
  // Vertikale Seitenstraße 1 (Z von -10 bis 10 bei X = -4)
  for (let z = -10; z <= 10; z++) {
    roads.push({ id: `r-v1-${z}`, type: "road", position: [-4, 0, z], rotationY: 90 });
  }

  // Vertikale Seitenstraße 2 (Z von -10 bis 10 bei X = 4)
  for (let z = -10; z <= 10; z++) {
    roads.push({ id: `r-v2-${z}`, type: "road", position: [4, 0, z], rotationY: 90 });
  }

  return roads;
};

const HARDCODED_BUILDINGS: BuildingData[] = [
  {
    id: "1",
    position: [0.9, 0.9, -1],
    rotationY: 10,
    glb: "/models/rustic_house.glb",
    type: "Town Hall",
    owner: "Mayor",
    color: "gold",
  },
  {
    id: "2",
    position: [3, 0.9, -1],
    rotationY: -5,
    glb: "/models/barbie_house.glb",
    type: "Residential",
    owner: "Alice",
    color: "skyblue",
  },
  {
    id: "3",
position: [-3, 0.9, 1],
    rotationY: 30,
    glb: "/models/bunny_house_small.glb",
    type: "Industrial",
    owner: "Bob",
    color: "gray",
  },
  {
    id: "4",
position: [2.8, 0.9, -3],
    rotationY: 200,
    glb: "/models/bunny_house_small.glb",
    type: "Commercial",
    owner: "Charlie",
    color: "lightgreen",
  },
  ...createRoads(),
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
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <gridHelper args={[20, 20, 0x444444, 0x222222]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2d4c1e" />
      </mesh>

      {buildings.map((b) => {
        if (b.type === "road") {
          return (
            <RoadTile key={b.id} position={b.position} rotationY={b.rotationY} />
          );
        }
        return (
          <ModelBuilding
            key={b.id}
            url={b.glb!}
            position={b.position}
            opacity={!isXRay ? 1 : 0.5}
            rotationY={b.rotationY || 0}
            onClick={() => onBuildingClick(b)}
          />
        );
      })}

      <ModelX
            url="/models/bbt_logo.glb"
            position={[2, 0.9, 5]}
            opacity={!isXRay ? 1 : 0.5}
            rotationY={20}
            /* onClick={() => onBuildingClick(b)} */
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.25}
        scale={20}
        blur={1.5}
        far={0.8}
      />
      <Environment preset="city" />
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
      console.log("Connected to server");
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white font-sans">
      <div className="z-10 w-full max-w-5xl flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Town View: {townId}</h1>
          <p className="text-gray-400 text-sm">
            Coordinate your isometric empire
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={isXRay ? "default" : "outline"}
            onClick={() => setIsXRay(!isXRay)}
            className="text-xs"
          >
            {isXRay ? "Disable X-Ray" : "Enable X-Ray"}
          </Button>
          <div
            className={`px-3 py-1 rounded-full text-xs font-mono ${connected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
          >
            {connected ? "Connected" : "Disconnected"}
          </div>
          <Link href="/lobby" className="text-sm hover:underline text-gray-400">
            Back to Lobby
          </Link>
        </div>
      </div>

      <div className="relative w-full h-[70vh] border border-gray-700 rounded-xl overflow-hidden bg-black shadow-2xl">
        <Canvas shadows>
          <OrthographicCamera
            makeDefault
            position={[10, 10, 10]}
            zoom={40}
            near={0.1}
            far={1000}
          />
          <Scene
            buildings={HARDCODED_BUILDINGS}
            isXRay={isXRay}
            onBuildingClick={setSelectedBuilding}
          />
        </Canvas>
      </div>

      <Dialog
        open={!!selectedBuilding}
        onOpenChange={(open) => !open && setSelectedBuilding(null)}
      >
        <DialogContent className="sm:max-w-[425px] bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>{selectedBuilding?.type}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Building Details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-300">Owner:</span>
              <span>{selectedBuilding?.owner}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-300">Location:</span>
              <span>[{selectedBuilding?.position?.join(", ")}]</span>
            </div>
            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">
                This {selectedBuilding?.type.toLowerCase()} is currently
                functioning at 100% capacity.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center text-gray-400">
        <p className="text-sm">
          Tip: Use right-click to rotate and scroll to zoom.
        </p>
      </div>
    </main>
  );
}
