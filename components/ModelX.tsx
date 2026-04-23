"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export function ModelX({ 
  url, 
  position, 
  rotationY = 0, // Neuer Parameter für die Rotation (in Grad)
  opacity = 1, 
  onClick 
}: { 
  url: string, 
  position: [number, number, number], 
  rotationY?: number, // Rotation um die Hochachse
  opacity?: number,
  onClick?: () => void 
}) {
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
          mesh.material.transparent = true;
          mesh.material.opacity = opacity;
        }
      }
    });
    return clone;
  }, [scene, opacity]);

  // Umrechnung von Grad in Bogenmaß (Radians), da Three.js Radians erwartet
  const rotationInRadians = useMemo(() => (rotationY * Math.PI) / 180, [rotationY]);

  return (
    <primitive 
      object={clonedScene} 
      position={position} 
      // [X, Y, Z] Rotation – wir drehen nur um Y
      rotation={[0, rotationInRadians, 0]} 
      onClick={(e: any) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    />
  );
}