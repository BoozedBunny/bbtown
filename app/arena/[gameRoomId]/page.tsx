"use client";

import { use, useEffect, useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import { Loader2, Swords, Trophy, Users } from "lucide-react";
import * as THREE from "three";

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

function Player({ position, rotation, isMe, username }: { position: [number, number, number], rotation: number, isMe: boolean, username: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.4, 1, 4, 8]} />
        <meshStandardMaterial color={isMe ? "#BD00FF" : "#FFB800"} />
      </mesh>
      {/* Simple Username Label */}
      <mesh position={[0, 1.5, 0]}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Beam({ position, width }: { position: [number, number, number], width: number }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[width, 0.5, 0.5]} />
      <meshStandardMaterial color="#FF4D00" emissive="#FF4D00" emissiveIntensity={2} />
    </mesh>
  );
}

function ArenaScene({
  players,
  obstacles,
  onMove
}: {
  players: PlayerState[],
  obstacles: Obstacle[],
  onMove: (pos: [number, number, number], rot: number) => void
}) {
  const myPlayer = useRef<THREE.Group>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
    const handleUp = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!myPlayer.current) return;

    const speed = 5 * delta;
    const move = new THREE.Vector3();
    if (keys['w']) move.z -= 1;
    if (keys['s']) move.z += 1;
    if (keys['a']) move.x -= 1;
    if (keys['d']) move.x += 1;

    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed);
      myPlayer.current.position.add(move);
      onMove(
        [myPlayer.current.position.x, myPlayer.current.position.y, myPlayer.current.position.z],
        myPlayer.current.rotation.y
      );
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} castShadow intensity={1.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* Arena Platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[10, 20]} />
        <meshStandardMaterial color="#1A0A2E" roughness={0.8} />
      </mesh>

      {/* Players */}
      {players.map(p => (
        <Player
          key={p.id}
          position={p.position}
          rotation={p.rotation}
          isMe={p.id === players.find(player => player.username === (window as any).currentUser?.username)?.id}
          username={p.username}
        />
      ))}

      {/* Hidden local player for input handling */}
      <group ref={myPlayer} position={[0, 0, 0]} />

      {/* Obstacles */}
      {obstacles.map(obs => (
        <Beam key={obs.id} position={obs.position} width={obs.width} />
      ))}

      <PerspectiveCamera makeDefault position={[0, 10, 15]} fov={50} />
      <OrbitControls target={[0, 0, 0]} enablePan={false} />
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
  }>({ players: [], obstacles: [], status: 'waiting' });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("connect", () => {
      console.log("Socket connected, joining room:", gameRoomId);
      setConnected(true);
      s.emit("join_arena_room", { roomId: gameRoomId });
    });

    s.on("game_state", (state) => {
      setGameState(state);
    });

    s.on("game_start", ({ players }) => {
      console.log("Game started with players:", players);
      setGameState(prev => ({ ...prev, status: 'playing', players }));
    });

    s.on("opponent_left", () => {
      setGameState(prev => ({ ...prev, status: 'finished' }));
    });

    // Fetch current user info for isMe comparison
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

  return (
    <main className="flex min-h-screen flex-col bg-[#05010a] text-white font-sans overflow-hidden relative">
      {/* Debug Info */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-[10px] text-gray-500 pointer-events-none">
        Status: {gameState.status} | Players: {gameState.players.length} | Connected: {connected ? 'Yes' : 'No'}
      </div>

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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#05010a]/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-brand-secondary/20 rounded-3xl flex items-center justify-center mb-8 border border-brand-secondary/30">
            <Trophy className="w-12 h-12 text-brand-secondary" />
          </div>
          <h2 className="text-4xl font-heading font-bold mb-4">Opponent Disconnected</h2>
          <p className="text-gray-400 mb-8 text-center max-w-sm">
            The match has ended prematurely. Returning to town...
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-brand-primary hover:bg-brand-primary/90 rounded-xl font-bold transition-all pointer-events-auto"
          >
            Return to Town
          </button>
        </div>
      )}

      <Canvas shadows>
        <ArenaScene
          players={gameState.players}
          obstacles={gameState.obstacles}
          onMove={handleMove}
        />
      </Canvas>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-4 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="flex gap-1">
            {['W', 'A', 'S', 'D'].map(k => (
              <div key={k} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                {k}
              </div>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">to Move</span>
        </div>
      </div>
    </main>
  );
}
