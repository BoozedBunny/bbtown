"use client";

import { use, useEffect, useState, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls, Stars } from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import { Loader2, Swords, Trophy, Users } from "lucide-react";
import * as THREE from "three";
import { Physics, RigidBody } from "@react-three/rapier";
import Ecctrl from "ecctrl";
import { useRouter } from "next/navigation";

interface PlayerState {
  id: string;
  username: string;
  position: [number, number, number];
  rotation: number;
}

interface Obstacle {
  id: string;
  type: "beam";
  position: [number, number, number];
  speed: number;
  width: number;
}

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["Shift"] },
];

function LocalPlayer({
  onMove,
  onFall,
}: {
  onMove: (pos: [number, number, number], rot: number) => void;
  onFall: () => void;
}) {
  // We use a group ref inside Ecctrl to safely track position without Rapier API mismatches
  const innerRef = useRef<THREE.Group>(null);
  const lastPos = useRef<[number, number, number]>([0, 0, 0]);
  const lastRot = useRef<number>(0);
  const fellRef = useRef(false);

  useFrame(() => {
    if (!innerRef.current) return;

    // 1. Get world position
    const worldPos = new THREE.Vector3();
    innerRef.current.getWorldPosition(worldPos);

    // 2. Get world rotation
    const worldQuat = new THREE.Quaternion();
    innerRef.current.getWorldQuaternion(worldQuat);
    const euler = new THREE.Euler().setFromQuaternion(worldQuat);
    const currentYRot = euler.y;

    const pos: [number, number, number] = [worldPos.x, worldPos.y, worldPos.z];

    // Check for fall (Threshold is Y < -5)
    if (pos[1] < -5 && !fellRef.current) {
      fellRef.current = true;
      onFall();
    }

    // Only emit if moved or rotated significantly to save bandwidth
    const dist = Math.sqrt(
      Math.pow(pos[0] - lastPos.current[0], 2) +
        Math.pow(pos[1] - lastPos.current[1], 2) +
        Math.pow(pos[2] - lastPos.current[2], 2),
    );
    const rotDist = Math.abs(currentYRot - lastRot.current);

    if (dist > 0.05 || rotDist > 0.05) {
      lastPos.current = pos;
      lastRot.current = currentYRot;
      onMove(pos, currentYRot);
    }
  });

  return (
    <Ecctrl
      animated
      maxVelLimit={5}
      position={[0, 10, 0]} // Drop in from above to ensure we don't spawn inside the floor
    >
      <group ref={innerRef}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.4, 0.7]} />
          <meshStandardMaterial color="#BD00FF" />
        </mesh>
      </group>
    </Ecctrl>
  );
}

function RemotePlayer({
  position,
  rotation,
  username,
}: {
  position: [number, number, number];
  rotation: number;
  username: string;
}) {
  const rbRef = useRef<any>(null);

  useEffect(() => {
    if (rbRef.current) {
      // Safely update the Rapier kinematic body
      rbRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true,
      );
      rbRef.current.setRotation(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
        true,
      );
    }
  }, [position, rotation]);

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid">
      <group>
        <mesh castShadow position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.4, 0.7]} />
          <meshStandardMaterial color="#FFB800" />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Beam({
  position,
  width,
}: {
  position: [number, number, number];
  width: number;
}) {
  const rbRef = useRef<any>(null);

  useEffect(() => {
    if (rbRef.current) {
      rbRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true,
      );
    }
  }, [position]);

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid">
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.5, 0.5]} />
        <meshStandardMaterial
          color="#FF4D00"
          emissive="#FF4D00"
          emissiveIntensity={2}
        />
      </mesh>
    </RigidBody>
  );
}

function ArenaScene({
  players,
  obstacles,
  onMove,
  onFall,
  status,
  socketId,
}: {
  players: PlayerState[];
  obstacles: Obstacle[];
  onMove: (pos: [number, number, number], rot: number) => void;
  onFall: () => void;
  status: string;
  socketId: string | null;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        castShadow
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
      />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      <Physics gravity={[0, -9.81, 0]}>
        {/* We place the position on the RigidBody, NOT the mesh, to ensure the collider matches */}
        <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[10, 1, 20]} />
            <meshStandardMaterial color="#1A0A2E" roughness={0.8} />
          </mesh>
        </RigidBody>

        {status === "playing" && (
          <LocalPlayer onMove={onMove} onFall={onFall} />
        )}

        {players
          .filter((p) => p.id !== socketId)
          .map((p) => (
            <RemotePlayer
              key={p.id}
              position={p.position}
              rotation={p.rotation}
              username={p.username}
            />
          ))}

        {obstacles.map((obs) => (
          <Beam key={obs.id} position={obs.position} width={obs.width} />
        ))}
      </Physics>

      {/* Removed the extra PerspectiveCamera so Ecctrl can use its own third-person camera! */}
    </>
  );
}

export default function ArenaPage({
  params,
}: {
  params: Promise<{ gameRoomId: string }>;
}) {
  const { gameRoomId } = use(params);
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<{
    players: PlayerState[];
    obstacles: Obstacle[];
    status: "waiting" | "playing" | "finished";
    winner?: string;
    loser?: string;
    reward?: number;
  }>({ players: [], obstacles: [], status: "waiting" });
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      s.emit("join_arena_room", { roomId: gameRoomId });
    });

    s.on("game_state", (state) => {
      setGameState((prev) => ({ ...prev, ...state }));
    });

    s.on("game_start", ({ players }) => {
      setGameState((prev) => ({ ...prev, status: "playing", players }));
    });

    s.on("game_over", (data) => {
      setGameState((prev) => ({ ...prev, status: "finished", ...data }));
    });

    s.on("opponent_left", () => {
      setGameState((prev) => ({ ...prev, status: "finished" }));
    });

    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setCurrentUser(data);
      });

    return () => {
      s.disconnect();
    };
  }, [gameRoomId]);

  const handleMove = (position: [number, number, number], rotation: number) => {
    socket?.emit("player_move", { roomId: gameRoomId, position, rotation });
  };

  const handleFall = () => {
    if (gameState.status === "playing") {
      socket?.emit("player_fell", { roomId: gameRoomId });
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#05010a] text-white font-sans overflow-hidden relative">
      <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-primary/20 rounded-xl flex items-center justify-center">
            <Swords className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Room
            </h2>
            <p className="font-mono text-brand-secondary font-bold">
              {gameRoomId}
            </p>
          </div>
        </div>

        {gameState.status === "playing" && (
          <div className="bg-black/40 backdrop-blur-xl px-8 py-3 rounded-full border border-green-500/30 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-400">
              Match in Progress
            </span>
          </div>
        )}

        <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4">
          <Users className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Players
            </h2>
            <p className="text-sm font-bold">{gameState.players.length} / 2</p>
          </div>
        </div>
      </div>

      {gameState.status === "waiting" && (
        <div
          id="waiting-overlay"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05010a]/80 backdrop-blur-sm"
        >
          <div className="w-20 h-20 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-heading font-bold mb-2">
            Waiting for Opponent
          </h2>
          <p className="text-gray-400 animate-pulse">
            Match will start automatically...
          </p>
        </div>
      )}

      {gameState.status === "finished" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#05010a]/90 backdrop-blur-md animate-in fade-in duration-500 text-center">
          {!currentUser ? (
            <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
          ) : (
            <>
              <div className="w-24 h-24 bg-brand-secondary/20 rounded-3xl flex items-center justify-center mb-8 border border-brand-secondary/30 mx-auto">
                {gameState.winner === currentUser.username ? (
                  <Trophy className="w-12 h-12 text-brand-secondary" />
                ) : (
                  <Swords className="w-12 h-12 text-red-500" />
                )}
              </div>
              <h2
                className={`text-5xl font-heading font-bold mb-2 ${gameState.winner === currentUser.username ? "text-brand-secondary" : "text-red-500"}`}
              >
                {gameState.winner === currentUser.username
                  ? "VICTORY!"
                  : "DEFEAT"}
              </h2>
              <div className="space-y-2 mb-8">
                <p className="text-xl text-gray-400">
                  {gameState.winner
                    ? `${gameState.winner} won the battle!`
                    : "The match has ended."}
                </p>
                {gameState.winner === currentUser.username && (
                  <div className="bg-brand-secondary/20 px-4 py-2 rounded-full border border-brand-secondary/30 inline-block">
                    <span className="text-brand-secondary font-bold text-lg">
                      💰 +{gameState.reward?.toLocaleString() || 0} BBT Reward
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push("/")}
                className="px-12 py-4 bg-brand-primary hover:bg-brand-primary/90 rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(189,0,255,0.3)] hover:scale-105 active:scale-95 pointer-events-auto"
              >
                Back to Simulation
              </button>
            </>
          )}
        </div>
      )}

      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <KeyboardControls map={keyboardMap}>
            <Canvas shadows>
              <ArenaScene
                players={gameState.players}
                obstacles={gameState.obstacles}
                onMove={handleMove}
                onFall={handleFall}
                status={gameState.status}
                socketId={socket?.id || null}
              />
            </Canvas>
          </KeyboardControls>
        </Suspense>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-4 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="flex gap-1">
            {["W", "A", "S", "D"].map((k) => (
              <div
                key={k}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold"
              >
                {k}
              </div>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">
            to Move • Space to Jump
          </span>
        </div>
      </div>
    </main>
  );
}
