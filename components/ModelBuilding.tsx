"use client";

import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Search } from "lucide-react";

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
  const groupRef = useRef<THREE.Group>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isBalloon = url.includes("up_up_balloon");

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

  // Balloon Animation
  useFrame((state) => {
    if (isBalloon && groupRef.current) {
      // Bobbing effect
      const time = state.clock.getElapsedTime();
      // Base Y position is position[1]. 
      // We'll use local position.y since group is at position={position}
      groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.2;
    }
  });

  const handlePointerEnter = (e: any) => {
    e.stopPropagation();
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHovered(true);
  };

  const handlePointerLeave = (e: any) => {
    hideTimeoutRef.current = setTimeout(() => {
      setHovered(false);
      document.body.style.cursor = 'auto';
    }, 150);
  };

  const rotationInRadians = useMemo(() => (rotationY * Math.PI) / 180, [rotationY]);

  return (
    <group 
      ref={groupRef}
      position={position} 
      rotation={[0, rotationInRadians, 0]}
    >
      <primitive 
        object={clonedScene} 
        onPointerOver={handlePointerEnter}
        onPointerOut={handlePointerLeave}
      />
      
      {hovered && (
        <Html position={[0, 1.5, 0.5]} center zIndexRange={[100, 0]}>
          <div 
            className="bg-brand-primary p-2 rounded-full cursor-pointer shadow-[0_0_15px_rgba(189,0,255,0.8)] border-2 border-white animate-bounce pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
            onPointerOver={() => {
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
              }
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
              hideTimeoutRef.current = setTimeout(() => {
                setHovered(false);
                document.body.style.cursor = 'auto';
              }, 150);
            }}
          >
            <Search className="w-5 h-5 text-white" />
          </div>
        </Html>
      )}
    </group>
  );
}
