"use client";

import { Environment } from "@react-three/drei";
import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";

export function DayNightCycle({ serverTime }: { serverTime?: string }) {
  const [currentTime, setCurrentTime] = useState<Date>(
    serverTime ? new Date(serverTime) : new Date()
  );

  // Tick the clock locally every second to avoid constant API polling
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime((prev) => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize with serverTime when it is updated from the API
  useEffect(() => {
    if (serverTime) {
      setCurrentTime(new Date(serverTime));
    }
  }, [serverTime]);

  const { isDay, sunPosition, ambientIntensity, environmentPreset, sunIntensity } = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const totalHours = hours + minutes / 60 + seconds / 3600;

    // Define Day as 06:00 to 18:00
    const isDay = totalHours >= 6 && totalHours < 18;

    if (isDay) {
      // Map 06:00-18:00 to an arc
      // 06:00 -> progress 0 -> angle -PI/2 (East)
      // 12:00 -> progress 0.5 -> angle 0 (Zenith)
      // 18:00 -> progress 1 -> angle PI/2 (West)
      const progress = (totalHours - 6) / 12;
      const angle = (progress - 0.5) * Math.PI;

      // Calculate sun position in an arc
      const x = Math.sin(angle) * 20;
      const y = Math.cos(angle) * 20;
      const z = 5;

      return {
        isDay: true,
        sunPosition: [x, y, z] as [number, number, number],
        ambientIntensity: 0.6,
        sunIntensity: 3.0,
        environmentPreset: "city" as const,
      };
    } else {
      // Nighttime logic: "just a bit darker, without a moving sun or shadows"
      return {
        isDay: false,
        sunPosition: [10, 10, 5] as [number, number, number], // Static position if ever needed
        ambientIntensity: 0.3,
        sunIntensity: 0,
        environmentPreset: "night" as const,
      };
    }
  }, [currentTime]);

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      {isDay && (
        <directionalLight
          position={sunPosition}
          intensity={sunIntensity}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
      )}
      <Environment preset={environmentPreset} />
    </>
  );
}
