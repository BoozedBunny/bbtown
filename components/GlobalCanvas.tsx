"use client";

import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { useRef } from "react";

export function GlobalCanvas() {
  return (
    <Canvas
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: -1,
      }}
      eventSource={
        typeof window !== "undefined"
          ? document.getElementById("__next") || document.body
          : undefined
      }
      shadows
    >
      <View.Port />
    </Canvas>
  );
}
