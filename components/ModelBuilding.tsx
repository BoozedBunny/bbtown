"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";

export function ModelBuilding({ 
  url, 
  position, 
  rotationY = 0, 
  opacity = 1, 
  onClick 
}: { 
  url: string, 
  position: [number, number, number], 
  rotationY?: number, 
  opacity?: number,
  onClick?: () => void 
}) {
  const { scene } = useGLTF(url);
  const [hovered, setHovered] = useState(false);

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

  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (hovered) {
            mat.emissive = new THREE.Color(0x333333);
            mat.emissiveIntensity = 0.5;
          } else {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [hovered, clonedScene]);

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
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    />
  );
}