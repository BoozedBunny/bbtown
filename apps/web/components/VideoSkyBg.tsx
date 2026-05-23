"use client";

import { ThreeEvent } from "@react-three/fiber";
import { useVideoTexture } from "@react-three/drei";
import * as THREE from "three";

export function VideoSkyBg({
  url,
  onPointerMove,
  onClick,
}: {
  url: string;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  // useVideoTexture handles video loading, autoplay, loop, and muting automatically.
  // Muted is strictly required by browsers for autoplaying videos without user interaction.
  const texture = useVideoTexture(url, {
    start: true,
    crossOrigin: "Anonymous",
    muted: true,
    loop: true,
  });

  // Ensure the texture behaves correctly on the plane
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);

  // The calculated dimensions based on the pixel expansion
  const newWidth = 36.923;
  const newHeight = 12;

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -0.2, -8]}
      receiveShadow
      onPointerMove={onPointerMove}
      onClick={onClick}
    >
      <planeGeometry args={[newWidth, newHeight]} />
      {/* 
        Using meshStandardMaterial means the video will be affected by your scene's lighting (DayNightCycle).
        If you want the video to glow or ignore lighting, you could use meshBasicMaterial instead.
      */}
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}