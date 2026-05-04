"use client";

import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Search, Landmark, Swords } from "lucide-react";

export function ModelBuilding({ 
  id,
  url, 
  position, 
  rotationY = 0, 
  opacity = 1, 
  onClick 
}: { 
  id?: string,
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
        }
      }
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
           mat.transparent = true;
          mat.opacity = opacity;
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
  }, [hovered, opacity, clonedScene]);

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

  const Icon = useMemo(() => {
    if (id === "4") return Landmark;
    if (id === "21") return Swords;
    return Search;
  }, [id]);

  const iconBgColor = useMemo(() => {
    if (id === "4") return "bg-brand-secondary shadow-[0_0_15px_rgba(255,184,0,0.8)]";
    return "bg-brand-primary shadow-[0_0_15px_rgba(189,0,255,0.8)]";
  }, [id]);

  const iconPosition = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const h = box.max.y - box.min.y;
    // Special case for balloon which is higher up
    if (url.includes("up_up_balloon")) return [0, 0.5, 0] as [number, number, number];
    return [0, h * 0.8, 0] as [number, number, number];
  }, [clonedScene, url]);

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
        <Html position={iconPosition} center zIndexRange={[100, 0]}>
          <div 
            className={`${iconBgColor} p-2 rounded-full cursor-pointer border-2 border-white animate-bounce pointer-events-auto`}
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
            <Icon className="w-5 h-5 text-white" />
          </div>
        </Html>
      )}
    </group>
  );
}
