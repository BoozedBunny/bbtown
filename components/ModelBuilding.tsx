"use client";

import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Search, Landmark, Swords } from "lucide-react";

const HIDE_DELAY_MS = 200;
const FOLLOW_RADIUS_PX = 22;
const FOLLOW_DEAD_ZONE_PX = 7;
const FOLLOW_ALPHA = 0.2;

const TWO_PI = Math.PI * 2;

// up_up_balloon.glb motion tuning (QA/product):
// - BALLOON_BOB_AMP: 0.12-0.20
// - BALLOON_DRIFT_RADIUS: 0.06-0.12
// - BALLOON_YAW_SWAY_AMP: 2°-5°
// Keep frequencies low (<= 0.35Hz) for natural balloon inertia.
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
  scale?: number | [number, number, number], // Erlaubt gleichmäßige (number) oder achsenspezifische Skalierung (Array)
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
  scale = 1, // Neuer Parameter für die Größe (Standard: 1)
}: ModelBuildingProps) {
  const { scene } = useGLTF(url);
  const [hoverVisible, setHoverVisible] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isModelHotRef = useRef(false);
  const isIconHotRef = useRef(false);
  const hoverArmedRef = useRef(true);

  const followTargetRef = useRef({ x: 0, y: 0 });
  const followCurrentRef = useRef({ x: 0, y: 0 });
  const followRafRef = useRef<number | null>(null);
  const iconTargetRef = useRef<HTMLDivElement | null>(null);

  const isBalloon = url.includes("up_up_balloon");
  const isCoarsePointerRef = useRef(false);
  const pendingModalOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      isCoarsePointerRef.current = window.matchMedia("(pointer: coarse)").matches;
    }
  }, []);

  const isExternallyActive = !activeHoverBuildingId || activeHoverBuildingId === id;

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
          if (hoverVisible) {
            mat.emissive = new THREE.Color(0x333333);
            mat.emissiveIntensity = 0.5;
          } else {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [hoverVisible, opacity, clonedScene]);

  useEffect(() => {
    if (activeHoverBuildingId && activeHoverBuildingId !== id) {
      isModelHotRef.current = false;
      isIconHotRef.current = false;
      setHoverVisible(false);
      followTargetRef.current = { x: 0, y: 0 };
      followCurrentRef.current = { x: 0, y: 0 };
      if (iconTargetRef.current) {
        iconTargetRef.current.style.transform = "translate3d(0px, 0px, 0)";
      }
    }
  }, [activeHoverBuildingId, id]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (followRafRef.current) {
        cancelAnimationFrame(followRafRef.current);
      }
      document.body.style.cursor = "auto";
    };
  }, []);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const forceHideHover = (disarmHover = false) => {
    clearHideTimeout();
    isModelHotRef.current = false;
    isIconHotRef.current = false;
    if (disarmHover) {
      hoverArmedRef.current = false;
    }
    setHoverVisible(false);
    if (activeHoverBuildingId === id && onHoverBuildingChange) {
      onHoverBuildingChange(null);
    }
    document.body.style.cursor = "auto";
    followTargetRef.current = { x: 0, y: 0 };
    followCurrentRef.current = { x: 0, y: 0 };
    if (iconTargetRef.current) {
      iconTargetRef.current.style.transform = "translate3d(0px, 0px, 0)";
    }
  };

  const showHover = () => {
    if (hoverSuppressed || !hoverArmedRef.current) return;
    clearHideTimeout();
    setHoverVisible(true);
    if (id && onHoverBuildingChange) onHoverBuildingChange(id);
  };

  const scheduleHideIfCold = () => {
    if (isModelHotRef.current || isIconHotRef.current) return;
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!isModelHotRef.current && !isIconHotRef.current) {
        setHoverVisible(false);
        if (activeHoverBuildingId === id && onHoverBuildingChange) {
          onHoverBuildingChange(null);
        }
        document.body.style.cursor = "auto";
        followTargetRef.current = { x: 0, y: 0 };
      }
    }, HIDE_DELAY_MS);
  };

  const clampFollow = (x: number, y: number) => {
    const dist = Math.hypot(x, y);
    if (dist <= FOLLOW_DEAD_ZONE_PX) return { x: 0, y: 0 };
    if (dist <= FOLLOW_RADIUS_PX) return { x, y };
    const scale = FOLLOW_RADIUS_PX / dist;
    return { x: x * scale, y: y * scale };
  };

  const startFollowLoop = () => {
    if (followRafRef.current !== null) return;

    const tick = () => {
      const target = followTargetRef.current;
      const current = followCurrentRef.current;

      current.x += (target.x - current.x) * FOLLOW_ALPHA;
      current.y += (target.y - current.y) * FOLLOW_ALPHA;

      if (Math.abs(current.x) < 0.5) current.x = 0;
      if (Math.abs(current.y) < 0.5) current.y = 0;

      if (iconTargetRef.current) {
        iconTargetRef.current.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      }

      const stillActive = hoverVisible || isModelHotRef.current || isIconHotRef.current;
      const nearlySettled =
        Math.abs(target.x - current.x) < 0.5 &&
        Math.abs(target.y - current.y) < 0.5 &&
        Math.abs(current.x) < 0.5 &&
        Math.abs(current.y) < 0.5;

      if (!stillActive && nearlySettled) {
        followRafRef.current = null;
        return;
      }

      followRafRef.current = requestAnimationFrame(tick);
    };

    followRafRef.current = requestAnimationFrame(tick);
  };

  const handlePointerEnter = (e: any) => {
    e.stopPropagation();
    if (hoverSuppressed) return;
    isModelHotRef.current = true;
    showHover();
  };

  const handlePointerLeave = (e: any) => {
    e.stopPropagation();
    isModelHotRef.current = false;
    if (!isIconHotRef.current && !hoverSuppressed) {
      hoverArmedRef.current = true;
    }
    followTargetRef.current = { x: 0, y: 0 };
    startFollowLoop();
    scheduleHideIfCold();
  };

  useEffect(() => {
    if (!hoverSuppressed) return;
    pendingModalOpenRef.current = false;
    forceHideHover(true);
  }, [hoverSuppressed]);

  const rotationInRadians = useMemo(() => (rotationY * Math.PI) / 180, [rotationY]);

  useFrame((state) => {
    if (!isBalloon || !groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const bob = Math.sin(TWO_PI * BALLOON_BOB_HZ * t + BALLOON_PHASE_BOB) * BALLOON_BOB_AMP;
    const driftAngle = TWO_PI * BALLOON_DRIFT_HZ * t + BALLOON_PHASE_DRIFT;
    const driftX = Math.cos(driftAngle) * BALLOON_DRIFT_RADIUS;
    const driftZ = Math.sin(driftAngle) * BALLOON_DRIFT_RADIUS;
    const yawSway =
      Math.sin(TWO_PI * BALLOON_YAW_SWAY_HZ * t + BALLOON_PHASE_YAW) * BALLOON_YAW_SWAY_AMP;

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
    if (url.includes("up_up_balloon")) return [0, 0.5, 0] as [number, number, number];
    return [0, h * 0.8, 0] as [number, number, number];
  }, [clonedScene, url]);

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationInRadians, 0]}>
      <primitive
        object={clonedScene}
        onPointerOver={handlePointerEnter}
        onPointerOut={handlePointerLeave}
        scale={scale}
      />

      {hoverVisible && isExternallyActive && (
        <Html position={iconPosition} center zIndexRange={[100, 0]}>
          <div
            ref={iconTargetRef}
            className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center"
            onPointerOver={(e) => {
              e.stopPropagation();
              if (hoverSuppressed) return;
              isIconHotRef.current = true;
              showHover();
              document.body.style.cursor = "pointer";
              startFollowLoop();
            }}
            onPointerMove={(e) => {
              if (hoverSuppressed) return;
              if (isCoarsePointerRef.current) return;
              const target = e.currentTarget as HTMLDivElement;
              const rect = target.getBoundingClientRect();
              const dx = e.clientX - (rect.left + rect.width / 2);
              const dy = e.clientY - (rect.top + rect.height / 2);
              followTargetRef.current = clampFollow(dx, dy);
              startFollowLoop();
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              isIconHotRef.current = false;
              if (!isModelHotRef.current && !hoverSuppressed) {
                hoverArmedRef.current = true;
              }
              followTargetRef.current = { x: 0, y: 0 };
              startFollowLoop();
              scheduleHideIfCold();
            }}
            onClick={(e) => {
              e.stopPropagation();
              pendingModalOpenRef.current = true;
              if (onClick) onClick();
            }}
          >
            <div
              className={`${iconBgColor} h-[38px] w-[38px] rounded-full border-2 border-white p-2 transition-transform hover:scale-105`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
