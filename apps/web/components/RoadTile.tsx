"use client";

import * as THREE from "three";

export function RoadTile({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const rotationInRadians = (rotationY * Math.PI) / 180;

  return (
    <mesh
      position={[position[0], position[1] + 0.01, position[2]]}
      rotation={[-Math.PI / 2, 0, rotationInRadians]}
      receiveShadow
    >
      <planeGeometry args={[1, 1]} />
      {/* Deep navy color for the road to match brand-neutral #0F021A but slightly lighter for visibility */}
      <meshStandardMaterial color="#1A0A2E" />
    </mesh>
  );
}
