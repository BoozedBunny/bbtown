"use client";

import { Environment, Sky } from "@react-three/drei";
import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";

const TUNING = {
  sunRadius: 26,
  sunZ: 8,
  minAmbient: 0.34,
  maxAmbient: 0.52,
  minDirectional: 0.22,
  maxDirectional: 1.7,
  skyDistance: 450000,
};

export function DayNightCycle({ serverTime }: { serverTime?: string }) {
  const [currentTime, setCurrentTime] = useState<Date>(
    serverTime ? new Date(serverTime) : new Date()
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime((prev) => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (serverTime) {
      setCurrentTime(new Date(serverTime));
    }
  }, [serverTime]);

  const lighting = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const totalHours = hours + minutes / 60 + seconds / 3600;

    // 0..1 normalized day progress where 0 is midnight and 0.5 is noon
    const dayProgress = totalHours / 24;
    const solarAngle = dayProgress * Math.PI * 2 - Math.PI / 2;

    // -1..1 where >0 means sun above horizon
    const solarElevation = Math.sin(solarAngle);
    const daylight = THREE.MathUtils.clamp((solarElevation + 0.18) / 1.18, 0, 1);
    const softDaylight = THREE.MathUtils.smoothstep(daylight, 0, 1);

    const x = Math.cos(solarAngle) * TUNING.sunRadius;
    const y = THREE.MathUtils.lerp(-3, TUNING.sunRadius, softDaylight);
    const z = TUNING.sunZ;

    const ambientIntensity = THREE.MathUtils.lerp(
      TUNING.minAmbient,
      TUNING.maxAmbient,
      softDaylight
    );

    const sunIntensity = THREE.MathUtils.lerp(
      TUNING.minDirectional,
      TUNING.maxDirectional,
      softDaylight
    );

    const rayleigh = THREE.MathUtils.lerp(0.8, 2.1, softDaylight);
    const mieCoefficient = THREE.MathUtils.lerp(0.018, 0.004, softDaylight);
    const mieDirectionalG = THREE.MathUtils.lerp(0.65, 0.84, softDaylight);
    const turbidity = THREE.MathUtils.lerp(7.2, 2.6, softDaylight);

    const sunColor = new THREE.Color().setHSL(
      THREE.MathUtils.lerp(0.05, 0.11, softDaylight),
      THREE.MathUtils.lerp(0.55, 0.14, softDaylight),
      THREE.MathUtils.lerp(0.62, 0.98, softDaylight)
    );

    const isDay = solarElevation > 0;

    return {
      isDay,
      ambientIntensity,
      sunIntensity,
      sunPosition: [x, y, z] as [number, number, number],
      environmentPreset: isDay ? ("city" as const) : ("night" as const),
      sky: {
        distance: TUNING.skyDistance,
        sunPosition: new THREE.Vector3(x, y, z),
        rayleigh,
        mieCoefficient,
        mieDirectionalG,
        turbidity,
      },
      sunColor,
    };
  }, [currentTime]);

  return (
    <>
      <Sky
        distance={lighting.sky.distance}
        sunPosition={lighting.sky.sunPosition}
        rayleigh={lighting.sky.rayleigh}
        mieCoefficient={lighting.sky.mieCoefficient}
        mieDirectionalG={lighting.sky.mieDirectionalG}
        turbidity={lighting.sky.turbidity}
      />
      <ambientLight intensity={lighting.ambientIntensity} />
      <directionalLight
        position={lighting.sunPosition}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow={lighting.isDay}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Environment preset={lighting.environmentPreset} />
    </>
  );
}
