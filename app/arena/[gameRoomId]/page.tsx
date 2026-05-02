"use client";

import { use, useEffect, useState, useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import { Loader2, Swords, Trophy, Users } from "lucide-react";
import * as THREE from "three";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import Ecctrl from "ecctrl";

interface PlayerState {
  id: string;
  username: string;
  position: [number, number, number];
  rotation: number;
}

interface Obstacle {
  id: string;
  type: 'beam';
  position: [number, number, number];
  speed: number;
  width: number;
}

function LocalPlayer({ onMove, onFall }: { onMove: (pos: [number, number, number], rot: number) => void, onFall: () => void }) {
  const ecctrlRef = useRef<any>(null);
  const [lastPos, setLastPos] = useState<[number, number, number]>([0, 0, 0]);
  const fellRef = useRef(false);

  useFrame(() => {
    if (!ecctrlRef.current) return;

    const worldPos = ecctrlRef.current.translation();
    const pos: [number, number, number] = [worldPos.x, worldPos.y, worldPos.z];

    // Check for fall
    if (pos[1] < -5 && !fellRef.current) {
      fellRef.current = true;
      onFall();
    }

    // Only emit if moved significantly
    const dist = Math.sqrt(
      Math.pow(pos[0] - lastPos[0], 2) +
      Math.pow(pos[1] - lastPos[1], 2) +
      Math.pow(pos[2] - lastPos[2], 2)
    );

    if (dist > 0.05) {
      setLastPos(pos);
      onMove(pos, 0); // Rotation can be added later if Ecctrl exposes it easily
    }
  });

  return (
    <Ecctrl
      ref={ecctrlRef}
      debug
      animated
      maxVelLimit={5}
    >
      <mesh castShadow>
        <capsuleGeometry args={[0.4, 0.7]} />
        <meshStandardMaterial color="#BD00FF" />
      </mesh>
    </Ecctrl>
  );
}

function RemotePlayer({ position, rotation, username }: { position: [number, number, number], rotation: number, username: string }) {
  const rbRef = useRef<any>(null);

  useEffect(() => {
    if (rbRef.current) {
      rbRef.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    }
  }, [position]);

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid">
      <group rotation={[0, rotation, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 1, 4, 8]} />
          <meshStandardMaterial color="#FFB800" />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Beam({ position, width }: { position: [number, number, number], width: number }) {
  const rbRef = useRef<any>(null);

  useEffect(() => {
    if (rbRef.current) {
      rbRef.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    }
  }, [position]);

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid">
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.5, 0.5]} />
        <meshStandardMaterial color="#FF4D00" emissive="#FF4D00" emissiveIntensity={2} />
      </mesh>
    </RigidBody>
  );
}

function ArenaScene({
  players,
  obstacles,
  onMove,
  onFall,
  status
}: {
  players: PlayerState[],
  obstacles: Obstacle[],
  onMove: (pos: [number, number, number], rot: number) => void,
  onFall: () => void,
  status: string
}) {
  const myId = useRef<string | null>(null);

  useEffect(() => {
    const socketId = (window as any).socketId;
    if (socketId) myId.current = socketId;
  }, [status]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        castShadow
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
      />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Physics gravity={[0, -9.81, 0]}>
        {/* Arena Platform */}
        <RigidBody type="fixed" colliders="cuboid">
          <mesh receiveShadow position={[0, -0.5, 0]}>
            <boxGeometry args={[10, 1, 20]} />
            <meshStandardMaterial color="#1A0A2E" roughness={0.8} />
          </mesh>
        </RigidBody>

        {/* Local Player */}
        {status === 'playing' && <LocalPlayer onMove={onMove} onFall={onFall} />}

        {/* Remote Players */}
        {players.filter(p => p.id !== (window as any).socketId).map(p => (
          <RemotePlayer
            key={p.id}
            position={p.position}
            rotation={p.rotation}
            username={p.username}
          />
        ))}

        {/* Obstacles */}
        {obstacles.map(obs => (
          <Beam key={obs.id} position={obs.position} width={obs.width} />
        ))}
      </Physics>

      <PerspectiveCamera makeDefault position={[0, 10, 15]} fov={50} />
    </>
  );
}

export default function ArenaPage({
  params,
}: {
  params: Promise<{ gameRoomId: string }>;
}) {
  const { gameRoomId } = use(params);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<{
    players: PlayerState[];
    obstacles: Obstacle[];
    status: 'waiting' | 'playing' | 'finished';
    winner?: string;
    loser?: string;
  }>({ players: [], obstacles: [], status: 'waiting' });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      (window as any).socketId = s.id;
      s.emit("join_arena_room", { roomId: gameRoomId });
    });

    s.on("game_state", (state) => {
      setGameState(prev => ({ ...prev, ...state }));
    });

    s.on("game_start", ({ players }) => {
      setGameState(prev => ({ ...prev, status: 'playing', players }));
    });

    s.on("game_over", (data) => {
      setGameState(prev => ({ ...prev, status: 'finished', ...data }));
    });

    s.on("opponent_left", () => {
      setGameState(prev => ({ ...prev, status: 'finished' }));
    });

    fetch("/api/me").then(res => res.json()).then(data => {
      (window as any).currentUser = data;
    });

    return () => {
      s.disconnect();
    };
  }, [gameRoomId]);

  const handleMove = (position: [number, number, number], rotation: number) => {
    socket?.emit("player_move", { roomId: gameRoomId, position, rotation });
  };

  const handleFall = () => {
    socket?.emit("player_fell", { roomId: gameRoomId });
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#05010a] text-white font-sans overflow-hidden relative">
      {/* UI Overlay */}
      <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-primary/20 rounded-xl flex items-center justify-center">
            <Swords className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Room</h2>
            <p className="font-mono text-brand-secondary font-bold">{gameRoomId}</p>
          </div>
        </div>

        {gameState.status === 'playing' && (
          <div className="bg-black/40 backdrop-blur-xl px-8 py-3 rounded-full border border-green-500/30 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-400">Match in Progress</span>
          </div>
        )}

        <div className="bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center gap-4">
          <Users className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Players</h2>
            <p className="text-sm font-bold">{gameState.players.length} / 2</p>
          </div>
        </div>
      </div>

      {gameState.status === 'waiting' && (
        <div id="waiting-overlay" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05010a]/80 backdrop-blur-sm">
          <div className="w-20 h-20 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-heading font-bold mb-2">Waiting for Opponent</h2>
          <p className="text-gray-400 animate-pulse">Match will start automatically...</p>
        </div>
      )}

      {gameState.status === 'finished' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#05010a]/90 backdrop-blur-md animate-in fade-in duration-500 text-center">
          <div className="w-24 h-24 bg-brand-secondary/20 rounded-3xl flex items-center justify-center mb-8 border border-brand-secondary/30 mx-auto">
            <Trophy className="w-12 h-12 text-brand-secondary" />
          </div>
          <h2 className="text-4xl font-heading font-bold mb-2">
            {gameState.winner === (window as any).currentUser?.username ? 'VICTORY!' : 'DEFEAT'}
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            {gameState.winner} won the battle!
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-brand-primary hover:bg-brand-primary/90 rounded-xl font-bold transition-all pointer-events-auto"
          >
            Return to Town
          </button>
        </div>
      )}

      <Suspense fallback={null}>
        <Canvas shadows>
          <ArenaScene
            players={gameState.players}
            obstacles={gameState.obstacles}
            onMove={handleMove}
            onFall={handleFall}
            status={gameState.status}
          />
        </Canvas>
      </Suspense>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-4 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="flex gap-1">
            {['W', 'A', 'S', 'D'].map(k => (
              <div key={k} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                {k}
              </div>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">to Move • Space to Jump</span>
        </div>
      </div>
    </main>
  );
}
