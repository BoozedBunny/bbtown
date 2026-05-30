"use client";

import { Canvas } from "@react-three/fiber";
import { Sky, OrbitControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";

export default function RetroScene({ townId }: { townId: string }) {
  return (
    <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }} className="w-full h-full">
      <color attach="background" args={["#87CEEB"]} />
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[10, 10, 10]} intensity={1.5} shadow-mapSize={[1024, 1024]} />

      <Physics>
        {/* Ground */}
        <RigidBody type="fixed">
          <mesh receiveShadow position={[0, -0.5, 0]}>
            <boxGeometry args={[50, 1, 50]} />
            <meshStandardMaterial color="#4CAF50" />
          </mesh>
        </RigidBody>

        {/* Player Placeholder */}
        <RigidBody position={[0, 2, 0]} colliders="hull">
          <mesh castShadow>
            <boxGeometry args={[1, 2, 1]} />
            <meshStandardMaterial color="hotpink" />
          </mesh>
        </RigidBody>
      </Physics>

      <OrbitControls makeDefault />
    </Canvas>
  );
}
