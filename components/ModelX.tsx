"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export function ModelX({
  url,
  position,
  rotationY = 0,
  tiltX = 0, // Neuer Parameter für das "Nach-Hinten-Kippen" (in Grad)
  tiltZ = 0, // Neuer Parameter für das "Nach-Hinten-Kippen" (in Grad)
  scale = 1, // Neuer Parameter für die Größe (Standard: 1)
  opacity = 1,
  onClick,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  tiltX?: number; // Gradzahl, z.B. 45 oder 90 für flach liegend
  tiltZ?: number; // Gradzahl, z.B. 45 oder 90 für flach liegend
  scale?: number | [number, number, number]; // Erlaubt gleichmäßige (number) oder achsenspezifische Skalierung (Array)
  opacity?: number;
  onClick?: () => void;
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

  // Umrechnungen
  const radY = useMemo(() => (rotationY * Math.PI) / 180, [rotationY]);
  const radX = useMemo(() => (tiltX * Math.PI) / 180, [tiltX]);
  const radZ = useMemo(() => (tiltZ * Math.PI) / 180, [tiltZ]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      // Rotation: X = Kippen, Y = Drehen, Z = 0
      rotation={[radX, radY, radZ]}
      scale={scale} // Hier wird der neue Scale-Parameter angewendet
      onClick={(e: any) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    />
  );
}
