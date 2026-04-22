"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, ContactShadows, Environment } from "@react-three/drei";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Box position={[0, 0.5, 0]}>
        <meshStandardMaterial color="orange" />
      </Box>
      <ContactShadows position={[0, 0, 0]} opacity={0.25} scale={10} blur={1.5} far={0.8} />
      <Environment preset="city" />
      <OrbitControls />
    </>
  );
}

export default function GamePage() {
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
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Status: {connected ? "Connected" : "Disconnected"}
        </p>
      </div>

      <div className="relative flex place-items-center w-full h-[600px] border rounded-xl overflow-hidden">
        <Canvas camera={{ position: [3, 3, 3], fov: 75 }}>
          <Scene />
        </Canvas>
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
        <p className="text-sm opacity-50">
          Basic 3D Multiplayer Game Initialized.
        </p>
      </div>
    </main>
  );
}
