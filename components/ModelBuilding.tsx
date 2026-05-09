
"use client";

import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Search, Landmark, Swords } from "lucide-react";
import Image from "next/image";

const TWO_PI = Math.PI * 2;

// up_up_balloon.glb motion tuning (QA/product):
const BALLOON_BOB_AMP = 0.16;
const BALLOON_BOB_HZ = 0.22;
const BALLOON_DRIFT_RADIUS = 0.09;
const BALLOON_DRIFT_HZ = 0.11;
const BALLOON_YAW_SWAY_AMP = THREE.MathUtils.degToRad(3.5);
const BALLOON_YAW_SWAY_HZ = 0.14;
const BALLOON_PHASE_BOB = 0;
const BALLOON_PHASE_DRIFT = 1.2;
const BALLOON_PHASE_YAW = 2.1;

type ModelBuildingProps = {
  id?: string;
  url: string;
  position: [number, number, number];
  rotationY?: number;
  opacity?: number;
  onClick?: () => void;
  activeHoverBuildingId?: string | null;
  onHoverBuildingChange?: (id: string | null) => void;
  hoverSuppressed?: boolean;
  scale?: number | [number, number, number];
  ownerId?: string;
  ownerAvatar?: string;
  title?: string;
  ownerName?: string;
  forSale?: boolean;
  price?: number;
};

export function ModelBuilding({
  id,
  url,
  position,
  rotationY = 0,
  opacity = 1,
  onClick,
  activeHoverBuildingId,
  onHoverBuildingChange,
  hoverSuppressed = false,
  scale = 1,
  ownerId,
  ownerAvatar,
  title,
  ownerName,
  forSale,
  price,
}: ModelBuildingProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
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
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = opacity;
        }
      }
    });
    return clone;
  }, [scene, opacity]);

  const rotationInRadians = useMemo(() => (rotationY * Math.PI) / 180, [rotationY]);

  useFrame((state) => {
    if (!isBalloon || !groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const bob = Math.sin(TWO_PI * BALLOON_BOB_HZ * t + BALLOON_PHASE_BOB) * BALLOON_BOB_AMP;
    const driftAngle = TWO_PI * BALLOON_DRIFT_HZ * t + BALLOON_PHASE_DRIFT;
    const driftX = Math.cos(driftAngle) * BALLOON_DRIFT_RADIUS;
    const driftZ = Math.sin(driftAngle) * BALLOON_DRIFT_RADIUS;
    const yawSway = Math.sin(TWO_PI * BALLOON_YAW_SWAY_HZ * t + BALLOON_PHASE_YAW) * BALLOON_YAW_SWAY_AMP;

    groupRef.current.position.set(position[0] + driftX, position[1] + bob, position[2] + driftZ);
    groupRef.current.rotation.y = rotationInRadians + yawSway;
  });

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
    if (url.includes("up_up_balloon")) return [0, 0.7, 0] as [number, number, number]; // Slightly higher
    return [0, h * 0.9, 0] as [number, number, number]; // Increased to float elegantly above
  }, [clonedScene, url]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationInRadians, 0]}>
      <primitive
        object={clonedScene}
        scale={scale}
      />

      {!hoverSuppressed && (
        <Html position={iconPosition} center zIndexRange={[100, 0]}>
          <div
            className="pointer-events-auto group flex items-center cursor-pointer transition-all duration-300 opacity-70 hover:opacity-100 hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
          >
            {/* Icon/Avatar Container */}
            <div className="relative z-10 flex items-center justify-center">
              {ownerId && ownerAvatar ? (
                <div className="relative h-[48px] w-[48px] rounded-full border border-brand-primary/50 overflow-hidden shadow-[0_0_15px_rgba(189,0,255,0.6)] bg-brand-neutral">
                  <Image
                    src={`https://www.boozedbunnytown.com/media/avatars/${ownerAvatar}_avatar.webp`}
                    alt="Owner Avatar"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`${iconBgColor} h-[38px] w-[38px] rounded-full border border-brand-primary/50 p-2 flex items-center justify-center`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
              )}
            </div>

            {/* Expandable Popover Container */}
            <div className="absolute left-1/2 ml-[24px] top-1/2 -translate-y-1/2 overflow-hidden w-0 opacity-0 transition-all duration-300 ease-out group-hover:w-[180px] group-hover:opacity-100">
              <div className="w-[180px] cyber-panel px-3 py-2 text-left bg-[#0F021A]/95 rounded-r-lg border-y border-r border-brand-primary/30 shadow-[0_0_15px_rgba(189,0,255,0.3)]">
                <div className="text-[10px] uppercase font-black text-brand-primary tracking-widest mb-1 truncate">
                  {title || "Unknown Building"}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {ownerName || "No Owner"}
                </div>
                {forSale && price !== undefined && (
                  <div className="mt-1 text-[10px] text-green-400 font-bold tracking-wider">
                    FOR SALE: ${price.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
