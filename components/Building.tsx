"use client";

import { Box } from "@react-three/drei";
import { useState } from "react";
import { ThreeEvent } from "@react-three/fiber";

interface BuildingProps {
  position: [number, number, number];
  color?: string;
  type: string;
  owner: string;
  opacity?: number;
  transparent?: boolean;
  onClick: (data: { type: string; owner: string }) => void;
}

export function Building({
  position,
  color = "orange",
  type,
  owner,
  opacity = 1,
  transparent = false,
  onClick,
}: BuildingProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    console.log(`Building clicked: ${type}, Owner: ${owner}`);
    onClick({ type, owner });
  };

  return (
    <Box
      position={position}
      args={[1, 1, 1]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={hovered ? "hotpink" : color}
        opacity={opacity}
        transparent={transparent || opacity < 1}
      />
    </Box>
  );
}
