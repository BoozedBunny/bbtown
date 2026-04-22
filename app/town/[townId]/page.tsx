"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, ContactShadows, Environment, OrthographicCamera } from "@react-three/drei";
import { useEffect, useState, use } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";

function Scene({ color = "orange" }: { color?: string }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Box position={[0, 0.5, 0]}>
        <meshStandardMaterial color={color} />
      </Box>
      <ContactShadows position={[0, 0, 0]} opacity={0.25} scale={10} blur={1.5} far={0.8} />
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

export default function TownPage({ params }: { params: Promise<{ townId: string }> }) {
  const { townId } = use(params);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

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
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white">
      <div className="z-10 w-full max-w-5xl flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Town View: {townId}</h1>
        <div className="flex items-center gap-4">
          <p className={`px-3 py-1 rounded-full text-xs font-mono ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {connected ? "Connected" : "Disconnected"}
          </p>
          <Link href="/lobby" className="text-sm hover:underline text-gray-400">
            Back to Lobby
          </Link>
        </div>
      </div>

      <div className="relative w-full h-[70vh] border border-gray-700 rounded-xl overflow-hidden bg-black shadow-2xl">
        <Canvas shadows>
          <OrthographicCamera
            makeDefault
            position={[5, 5, 5]}
            zoom={40}
            near={0.1}
            far={1000}
          />
          <Scene />
        </Canvas>
      </div>

      <div className="mt-8 text-center text-gray-400">
        <p className="text-sm">
          Welcome to the future site of your isometric empire.
        </p>
      </div>
    </main>
  );
}
