"use client";

import { Html, useTexture, TransformControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Search, Landmark, Swords, TrendingUp, Dices } from "lucide-react";
import Image from "next/image";
import { ImageBuildingProps } from "../app/town/[townId]/town-types";

const TWO_PI = Math.PI * 2;

// Motion tuning (falls das Bild wie der Ballon animiert werden soll)
const BALLOON_BOB_AMP = 0.16;
const BALLOON_BOB_HZ = 0.22;
const BALLOON_DRIFT_RADIUS = 0.09;
const BALLOON_DRIFT_HZ = 0.11;
const BALLOON_YAW_SWAY_AMP = THREE.MathUtils.degToRad(3.5);
const BALLOON_YAW_SWAY_HZ = 0.14;
const BALLOON_PHASE_BOB = 0;
const BALLOON_PHASE_DRIFT = 1.2;
const BALLOON_PHASE_YAW = 2.1;

export function ImageBuilding({
  id,
  url,
  position,
  rotationY = 0,
  rotationX = 0,
  rotationZ = 0,
  opacity = 1,
  onClick,
  hoverSuppressed = false,
  scale = 1,
  ownerId,
  ownerAvatar,
  title,
  ownerName,
  forSale,
  price,
  iconPosition = 0.7,
  isTransformable,
  onTransform,
}: ImageBuildingProps) {
  // Lade das webp-Bild als Textur
  const texture = useTexture(url);

  // Stelle sicher, dass die Farben korrekt dargestellt werden
  texture.colorSpace = THREE.SRGBColorSpace;

  const groupRef = useRef<THREE.Group>(null);
  const isBalloon = url.includes("up_up_balloon");

  const rotationInRadiansY = useMemo(
    () => (rotationY * Math.PI) / 180,
    [rotationY],
  );
  const rotationInRadiansX = useMemo(
    () => (rotationX * Math.PI) / 180,
    [rotationX],
  );
  const rotationInRadiansZ = useMemo(
    () => (rotationZ * Math.PI) / 180,
    [rotationZ],
  );

  useFrame((state) => {
    if (!isBalloon || !groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const bob =
      Math.sin(TWO_PI * BALLOON_BOB_HZ * t + BALLOON_PHASE_BOB) *
      BALLOON_BOB_AMP;
    const driftAngle = TWO_PI * BALLOON_DRIFT_HZ * t + BALLOON_PHASE_DRIFT;
    const driftX = Math.cos(driftAngle) * BALLOON_DRIFT_RADIUS;
    const driftZ = Math.sin(driftAngle) * BALLOON_DRIFT_RADIUS;
    const yawSway =
      Math.sin(TWO_PI * BALLOON_YAW_SWAY_HZ * t + BALLOON_PHASE_YAW) *
      BALLOON_YAW_SWAY_AMP;

    groupRef.current.position.set(
      position[0] + driftX,
      position[1] + bob,
      position[2] + driftZ,
    );
    groupRef.current.rotation.y = rotationInRadiansY + yawSway;
    groupRef.current.rotation.x = rotationInRadiansX + yawSway;
    groupRef.current.rotation.z = rotationInRadiansZ + yawSway;
  });

  const Icon = useMemo(() => {
    if (id === "4") return Landmark;
    if (id === "21") return Swords;
    if (id === "24") return Dices;
    if (id === "25") return TrendingUp;
    return Search;
  }, [id]);

  const iconBgColor = useMemo(() => {
    if (id === "4" || id === "25")
      return "bg-brand-secondary shadow-[0_0_15px_rgba(255,184,0,0.8)]";
    return "bg-brand-primary shadow-[0_0_15px_rgba(189,0,255,0.8)]";
  }, [id]);

  const iconPositionRes = useMemo(() => {
    // Da wir jetzt eine 1x1 Plane haben, können wir die Höhe über den scale ableiten.
    // Eine Plane von 1 Einheit Höhe reicht von Y -0.5 bis +0.5.
    const h = typeof scale === "number" ? scale : scale[1];
    return [0, h * iconPosition, 0] as [number, number, number];
  }, [scale, url]);

  const specialBuildingConfig = useMemo(() => {
    if (id === "26") {
      return {
        title: "The Bank",
        colorClass: "text-brand-tertiary",
        borderClass: "border-brand-tertiary/30",
        shadowClass: "shadow-[0_0_15px_rgba(255,184,0,0.3)]",
      };
    }
    if (id === "21") {
      return {
        title: "The Arena",
        colorClass: "text-brand-primary",
        borderClass: "border-brand-primary/30",
        shadowClass: "shadow-[0_0_15px_rgba(189,0,255,0.3)]",
      };
    }
    if (id === "24") {
      return {
        title: "The Casino",
        colorClass: "text-brand-primary",
        borderClass: "border-brand-primary/30",
        shadowClass: "shadow-[0_0_15px_rgba(189,0,255,0.3)]",
      };
    }
    if (id === "25") {
      return {
        title: "Stock Exchange",
        colorClass: "text-brand-secondary",
        borderClass: "border-brand-secondary/30",
        shadowClass: "shadow-[0_0_15px_rgba(255,184,0,0.3)]",
      };
    }
    return null;
  }, [id]);

  const groupContent = (
    <>
      {/* 2D Plane anstelle des 3D Modells */}
      <mesh castShadow receiveShadow scale={scale}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={texture}
          transparent={true}
          opacity={opacity}
          side={THREE.DoubleSide}
          alphaTest={0.1} // Verhindert, dass völlig transparente Pixel Schatten werfen
        />
      </mesh>

      {!hoverSuppressed && (
        <Html position={iconPositionRes} center zIndexRange={[30, 0]}>
          <div
            className="select-none pointer-events-auto group flex items-center cursor-pointer transition-all duration-300 opacity-70 hover:opacity-100 hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
          >
            {/* Icon/Avatar Container */}
            <div className="relative z-10 flex items-center justify-center">
              {ownerId && ownerAvatar ? (
                <div className="relative h-[80px] w-[80px] rounded-full border border-brand-primary/50 overflow-hidden shadow-[0_0_15px_rgba(189,0,255,0.6)] bg-brand-neutral">
                  <Image
                    src={`https://www.boozedbunnytown.com/media/avatars/${ownerAvatar}_avatar.webp`}
                    alt="Owner Avatar"
                    fill
                    draggable={false}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className={`${iconBgColor} h-[64px] w-[64px] rounded-full border border-brand-primary/50 p-2 flex items-center justify-center`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>
              )}
            </div>

            {/* Expandable Popover Container */}
            <div className="absolute left-1/2 ml-[24px] top-1/2 -translate-y-1/2 overflow-hidden w-0 opacity-0 transition-all duration-300 ease-out group-hover:w-[180px] group-hover:opacity-100">
              <div
                className={`w-[180px] cyber-panel px-3 py-2 text-left bg-[#0F021A]/95 rounded-r-lg border-y border-r ${
                  specialBuildingConfig
                    ? specialBuildingConfig.borderClass
                    : "border-brand-primary/30"
                } ${
                  specialBuildingConfig
                    ? specialBuildingConfig.shadowClass
                    : "shadow-[0_0_15px_rgba(189,0,255,0.3)]"
                }`}
              >
                {specialBuildingConfig ? (
                  <div
                    className={`text-sm font-black tracking-widest uppercase mb-0 ${specialBuildingConfig.colorClass} truncate`}
                  >
                    {specialBuildingConfig.title}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </Html>
      )}
    </>
  );

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[rotationInRadiansX, rotationInRadiansY, rotationInRadiansZ]}
    >
      {isTransformable ? (
        <TransformControls
          mode="translate"
          onMouseUp={(e) => {
            if (onTransform && id && groupRef.current) {
              const pos = groupRef.current.position;
              onTransform(id, [pos.x, pos.y, pos.z]);
            }
          }}
        >
          {groupContent}
        </TransformControls>
      ) : (
        groupContent
      )}
    </group>
  );
}
