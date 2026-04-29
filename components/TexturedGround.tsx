"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export function TexturedGround({ 
  url, 
  onPointerMove, 
  onClick 
}: { 
  url: string;
  onPointerMove?: (e: any) => void;
  onClick?: (e: any) => void;
}) {
  const texture = useTexture(url);

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1); 

  // Die berechneten Maße basierend auf der Pixel-Expansion
  const newWidth = 36.923;
  const newHeight = 24.615;

  return (
    <mesh 
      rotation-x={-Math.PI / 2} 
      position={[0, 0, 0]} 
      receiveShadow
      onPointerMove={onPointerMove}
      onClick={onClick}
    >
      <planeGeometry args={[newWidth, newHeight]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}
