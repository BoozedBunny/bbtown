"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export function TexturedGround({ url }: { url: string }) {
  // Lädt die Textur
  const texture = useTexture(url);

  // Optional: Wenn das Bild gekachelt werden soll (Tiling), 
  // kannst du das hier einstellen. Bei einer kompletten Map 
  // lassen wir es meistens auf 1.
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1); 

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
      {/* Die Größe sollte zu deinem Grid passen, z.B. 30x30 */}
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}