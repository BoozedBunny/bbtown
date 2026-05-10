"use client";

import { useProgress } from "@react-three/drei";
import React, { useEffect, useState } from "react";

export function LoaderWrapper() {
  const { active, progress, errors, item, loaded, total } = useProgress();
  const [shown, setShown] = useState(true);

  useEffect(() => {
    // If we've loaded everything and active is false, fade out after a short delay
    if (!active && progress === 100) {
      const t = setTimeout(() => setShown(false), 500);
      return () => clearTimeout(t);
    } else if (active || progress < 100) {
      // Ensure it stays shown if it starts loading again
      setShown(true);
    }
  }, [active, progress]);

  if (!shown) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 35, // Below HUD elements (40) but above canvas
        background: "rgba(5, 1, 10, 0.9)", // Matches town theme background
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        transition: "opacity 300ms ease",
        opacity: active || progress < 100 ? 1 : 0,
      }}
    >
      <div style={{ color: "#bd00ff", fontFamily: "monospace", fontSize: "14px", fontWeight: "bold", marginBottom: "0.5rem" }}>
        LOADING ASSETS...
      </div>
      <div style={{ width: "200px", background: "rgba(189, 0, 255, 0.2)", height: "4px", borderRadius: "2px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#bd00ff",
            transition: "width 200ms ease",
          }}
        />
      </div>
      <div style={{ marginTop: "1rem", color: "#bd00ff", fontFamily: "monospace", fontSize: "14px", fontWeight: "bold" }}>
        {progress.toFixed(0)}%
      </div>
    </div>
  );
}
