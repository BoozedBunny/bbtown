"use client";

import { use, useEffect, useState, useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  KeyboardControls,
  Sky,
  Environment,
  Gltf,
  useKeyboardControls,
  useTexture,
  OrbitControls,
  RoundedBox,
  Sparkles,
  Box,
  Html as DreiHtml,
} from "@react-three/drei";
import { io, Socket } from "socket.io-client";
import { Loader2, Swords, Trophy, Users } from "lucide-react";
import * as THREE from "three";
import {
  Physics,
  RigidBody,
  useRapier,
  CuboidCollider,
} from "@react-three/rapier";
import { Model as Player } from "@/components/Player";
import { useRouter } from "next/navigation";
import { ArenaGlobalToplist } from "@/components/ArenaGlobalToplist";
import {
  DEFAULT_ROUND_TRANSITION_CONFIG,
  getRoundPhaseStateAt,
} from "@/lib/arena/roundPhases";
import {
  PostMatchEntry,
  ToplistEntry,
  rankToplistEntries,
} from "@/lib/arena/toplist";

type SpawnReason =
  | "initial_join"
  | "respawn"
  | "landing_reset"
  | "zone_transfer";

interface PlayerState {
  id: string;
  username: string;
  position: [number, number, number];
  rotation: number;
  anim: string;
  spawnReason?: SpawnReason;
  spawnSequence?: number;
  avatar?: string;
  bottlesCount: number;
}

interface Obstacle {
  id: string;
  type: "beam";
  position: [number, number, number];
  speed: number;
  width: number;
}

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["Shift"] },
  // Optional animation key map
  /* { name: "action1", keys: ["1"] },
  { name: "action2", keys: ["2"] },
  { name: "action3", keys: ["3"] },
  { name: "action4", keys: ["KeyF"] }, */
];

function LocalPlayer({
  onMove,
  onFall,
  initialSpawn,
  avatar = "bunny",
  socket,
  roomId,
  bottlesCount,
  barrel,
}: {
  onMove: (pos: [number, number, number], rot: number, anim: string) => void;
  onFall: () => void;
  initialSpawn?: Pick<PlayerState, "position" | "rotation" | "spawnSequence">;
  avatar?: string;
  socket: Socket | null;
  roomId: string;
  bottlesCount: number;
  barrel: { id: string; position: [number, number, number] } | null;
}) {
  const rigidBodyRef = useRef<any>(null);
  const modelRef = useRef<THREE.Group>(null);
  const [, getKeys] = useKeyboardControls();
  const { camera, gl } = useThree();

  const { rapier, world } = useRapier();
  const jumpPressed = useRef(false);
  const [currentAnim, setCurrentAnim] = useState("Idle_1");

  const SPEED = 6;
  const JUMP_FORCE = 6;

  const yaw = useRef(0);
  const pitch = useRef(0.3);
  const radius = useRef(8);
  const lastAppliedSpawnSequence = useRef<number>(-1);

  // --- COOLDOWNS & DEBUFFS STATE ---
  const knockbackTime = useRef(0);
  const castTime = useRef(0);
  const drunkUntil = useRef(0);
  const lastClaimedBarrelId = useRef<string | null>(null);

  useEffect(() => {
    if (!rigidBodyRef.current || !modelRef.current || !initialSpawn) return;

    const incomingSequence = initialSpawn.spawnSequence ?? 0;
    if (incomingSequence <= lastAppliedSpawnSequence.current) return;

    const [spawnX, spawnY, spawnZ] = initialSpawn.position;
    rigidBodyRef.current.setTranslation(
      { x: spawnX, y: spawnY + 5, z: spawnZ },
      true,
    );
    rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    modelRef.current.rotation.y = initialSpawn.rotation;
    yaw.current = initialSpawn.rotation - Math.PI;

    lastAppliedSpawnSequence.current = incomingSequence;
  }, [initialSpawn]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (currentAnim.startsWith("Idle")) {
      const waitTime = Math.random() * 6000 + 4000;

      timeout = setTimeout(() => {
        const idles = ["Idle_1", "Idle_2", "Idle_3"];
        const otherIdles = idles.filter((anim) => anim !== currentAnim);
        const randomIdle =
          otherIdles[Math.floor(Math.random() * otherIdles.length)];

        setCurrentAnim(randomIdle);
      }, waitTime);
    }

    return () => clearTimeout(timeout);
  }, [currentAnim]);

  useEffect(() => {
    const handleCanvasClick = () => {
      if (!document.pointerLockElement) {
        gl.domElement.requestPointerLock();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const sensitivity = 0.002;
        yaw.current -= e.movementX * sensitivity;
        pitch.current -= e.movementY * sensitivity;
        pitch.current = Math.max(0.1, Math.min(1.2, pitch.current));
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const zoomSensitivity = 0.005;
        radius.current += e.deltaY * zoomSensitivity;
        radius.current = Math.max(3, Math.min(15, radius.current));
      }
    };

    gl.domElement.addEventListener("click", handleCanvasClick);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("wheel", handleWheel);

    return () => {
      gl.domElement.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("wheel", handleWheel);
    };
  }, [gl.domElement]);

  // --- THROW BOTTLE ON CLICK ---
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
 
      if (e.button === 0) { // Left click
        const now = Date.now();
        const isLockedByKnockback = now < knockbackTime.current;
        const isLockedByCast = now < castTime.current;
 
        if (bottlesCount > 0 && !isLockedByKnockback && !isLockedByCast) {
          castTime.current = now + 1000; // 1s cast lock time
 
          if (rigidBodyRef.current) {
            const translation = rigidBodyRef.current.translation();
            // Clone positions to prevent references updating during delay
            const startX = translation.x;
            const startY = translation.y;
            const startZ = translation.z;
            
            // Calculate direction based on camera horizontal orientation (yaw)
            const camForward = new THREE.Vector3(
              -Math.sin(yaw.current),
              0,
              -Math.cos(yaw.current),
            ).normalize();
 
            // Project point on the ground 8 units in front of player
            const targetX = startX + camForward.x * 8;
            const targetZ = startZ + camForward.z * 8;
            const targetY = -0.6; // Floor level
 
            // Delay socket emission by 800ms to match the character's forward throwing animation motion
            setTimeout(() => {
              socket?.emit("throw_bottle", {
                roomId,
                targetPosition: [targetX, targetY, targetZ],
                startPosition: [startX, startY, startZ],
              });
            }, 800);
          }
        }
      }
    };
 
    window.addEventListener("mousedown", handleMouseDown);
 
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [gl.domElement, bottlesCount, socket, roomId]);

  // --- EXPLOSION IMPACT (KNOCKBACK & DEBUFF) ---
  useEffect(() => {
    if (!socket) return;

    const handleExplosionImpact = ({ targetPosition, radius, force }: { targetPosition: [number, number, number], radius: number, force: number }) => {
      if (!rigidBodyRef.current) return;
      const pos = rigidBodyRef.current.translation();
      const dx = pos.x - targetPosition[0];
      const dy = pos.y - targetPosition[1];
      const dz = pos.z - targetPosition[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius) {
        let dirX = dx;
        let dirZ = dz;
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
        if (len > 0) {
          dirX /= len;
          dirZ /= len;
        } else {
          dirX = Math.random() - 0.5;
          dirZ = Math.random() - 0.5;
        }

        const falloff = 1 - dist / radius;
        const finalForce = force * falloff;

        rigidBodyRef.current.setLinvel({
          x: dirX * finalForce,
          y: JUMP_FORCE * 1.5 * falloff,
          z: dirZ * finalForce
        }, true);

        knockbackTime.current = Date.now() + 1500;
        drunkUntil.current = Date.now() + 8000;
      }
    };

    socket.on("explosion_impact", handleExplosionImpact);
    return () => {
      socket.off("explosion_impact", handleExplosionImpact);
    };
  }, [socket]);

  useFrame(() => {
    if (!rigidBodyRef.current || !modelRef.current) return;

    const keys = getKeys();
    const velocity = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();

    const now = Date.now();
    const isLockedByKnockback = now < knockbackTime.current;
    const isLockedByCast = now < castTime.current;
    const isDrunk = now < drunkUntil.current;

    // --- BARREL COLLISION CHECK ---
    if (barrel && !roomId.startsWith("solo-") && lastClaimedBarrelId.current !== barrel.id) {
      const dx = pos.x - barrel.position[0];
      const dy = pos.y - barrel.position[1];
      const dz = pos.z - barrel.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1.8) {
        lastClaimedBarrelId.current = barrel.id;
        socket?.emit("claim_barrel", { roomId, barrelId: barrel.id });
      }
    }

    let inputX = 0;
    let inputZ = 0;

    if (!isLockedByKnockback && !isLockedByCast) {
      if (keys.forward) inputZ -= 1;
      if (keys.backward) inputZ += 1;
      if (keys.leftward) inputX -= 1;
      if (keys.rightward) inputX += 1;
    }

    const inputVec = new THREE.Vector2(inputX, inputZ);
    const isMoving = inputVec.lengthSq() > 0;
    const moveDir = new THREE.Vector3();

    const isWalkingBackward = keys.backward && !keys.forward;

    if (isMoving) {
      inputVec.normalize();

      const camForward = new THREE.Vector3(
        -Math.sin(yaw.current),
        0,
        -Math.cos(yaw.current),
      );
      const camRight = new THREE.Vector3(
        Math.cos(yaw.current),
        0,
        -Math.sin(yaw.current),
      );

      moveDir.add(camForward.multiplyScalar(-inputVec.y));
      moveDir.add(camRight.multiplyScalar(inputVec.x));

      let currentSpeed = SPEED;
      if (isDrunk) {
        currentSpeed = SPEED * 0.5;
      } else if (isWalkingBackward) {
        currentSpeed = SPEED * 0.8;
      } else if (keys.run) {
        currentSpeed = SPEED * 1.5;
      }

      moveDir.normalize().multiplyScalar(currentSpeed);

      let lookX = moveDir.x;
      let lookZ = moveDir.z;

      if (isWalkingBackward) {
        lookX = -moveDir.x;
        lookZ = -moveDir.z;
      }

      const targetAngle = Math.atan2(lookX, lookZ);
      const currentAngle = modelRef.current.rotation.y;

      let diff = targetAngle - currentAngle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));

      modelRef.current.rotation.y += diff * 0.15;
    }

    if (isLockedByKnockback) {
    } else if (isLockedByCast) {
      rigidBodyRef.current.setLinvel(
        { x: 0, y: velocity.y, z: 0 },
        true,
      );
    } else {
      rigidBodyRef.current.setLinvel(
        { x: moveDir.x, y: velocity.y, z: moveDir.z },
        true,
      );
    }

    const rayOrigin = { x: pos.x, y: pos.y - 0.95, z: pos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new rapier.Ray(rayOrigin, rayDir);

    const hit = world.castRay(ray, 0.5, true);
    const isGrounded = hit !== null && Math.abs(velocity.y) < 0.2;

    const currentJumpForce = isDrunk ? JUMP_FORCE * 0.6 : JUMP_FORCE;

    if (keys.jump && isGrounded && !jumpPressed.current && !isLockedByKnockback && !isLockedByCast) {
      jumpPressed.current = true;
      rigidBodyRef.current.setLinvel(
        { x: velocity.x, y: currentJumpForce, z: velocity.z },
        true,
      );
    } else if (!keys.jump) {
      jumpPressed.current = false;
    }

    let nextAnim = currentAnim;

    if (isLockedByKnockback) {
      nextAnim = "FreeFalling";
    } else if (isLockedByCast) {
      nextAnim = "throw_1";
    } else if (!isGrounded) {
      if (velocity.y < -4) {
        nextAnim = "FreeFalling";
      } else {
        nextAnim = "Jump";
      }
    } else if (isMoving) {
      if (isWalkingBackward) {
        nextAnim = "Walk_Backwards";
      } else if (isDrunk) {
        nextAnim = keys.run ? "drunk_1" : "drunk_2";
      } else {
        nextAnim = keys.run ? "Run" : "Walk";
      }
    } else {
      const REAL_IDLES = ["Idle_1", "Idle_2", "Idle_3"];
      if (!REAL_IDLES.includes(currentAnim)) {
        nextAnim = "Idle_1";
      }
    }

    if (nextAnim !== currentAnim) setCurrentAnim(nextAnim);

    const heightOffset = 1.2;

    const camX =
      pos.x + radius.current * Math.sin(yaw.current) * Math.cos(pitch.current);
    const camY =
      pos.y + heightOffset + radius.current * Math.sin(pitch.current);
    const camZ =
      pos.z + radius.current * Math.cos(yaw.current) * Math.cos(pitch.current);

    const targetCameraPos = new THREE.Vector3(camX, camY, camZ);

    camera.position.lerp(targetCameraPos, 0.2);
    camera.lookAt(pos.x, pos.y + heightOffset, pos.z);

    if (pos.y < -5) {
      onFall();
    } else {
      onMove([pos.x, pos.y, pos.z], modelRef.current.rotation.y, nextAnim);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      mass={1}
      type="dynamic"
      enabledRotations={[false, false, false]}
      friction={1}
    >
      <group ref={modelRef}>
        <Player
          currentAction={currentAnim}
          position={[0, -0.92, 0]}
          avatar={avatar}
        />
      </group>
    </RigidBody>
  );
}

function RemotePlayer({
  position,
  rotation,
  username,
  anim, // NEW: Receive animation state
  avatar = "bunny",
}: {
  position: [number, number, number];
  rotation: number;
  username: string;
  anim?: string; // NEW
  avatar?: string;
}) {
  const rbRef = useRef<any>(null);

  useEffect(() => {
    if (rbRef.current) {
      rbRef.current.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true,
      );
      rbRef.current.setRotation(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
        true,
      );
    }
  }, [position, rotation]);

  return (
    <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid">
      <group>
        {/* NEW: Replaced Capsule with the actual Player model and correct animation */}
        <Player
          currentAction={anim || "Idle_1"}
          position={[0, -0.92, 0]}
          avatar={avatar}
        />
      </group>
    </RigidBody>
  );
}

type ArenaEntryPhase =
  | "boot"
  | "preloading"
  | "ready_hold"
  | "fade_out_overlay"
  | "playing"
  | "load_error";

type GameOverPayload = {
  winner?: string;
  loser?: string;
  reward?: number;
  mode?: "SP" | "MP";
  endedAt?: number;
  roundsReached?: number;
  entries?: PostMatchEntry[];
};

type ObstaclePreset = {
  id: string;
  startZ: number;
  speed: number;
  width: number;
  height: number;
  centerX: number;
  phaseOffsetMs: number;
};

const OBSTACLE_Z_MIN = -35;
const OBSTACLE_Z_MAX = 35;
const OBSTACLE_DEPTH = 1.2;
const OBSTACLE_BASE_Y = -0.02;

const OBSTACLE_PRESETS: ObstaclePreset[] = [
  {
    id: "jump-gate-full",
    startZ: -35,
    speed: 8,
    width: 38,
    height: 1.8,
    centerX: 0,
    phaseOffsetMs: 0,
  },
  {
    id: "short-left-block",
    startZ: -35,
    speed: 6,
    width: 28,
    height: 2.2,
    centerX: -12,
    phaseOffsetMs: 1100,
  },
  {
    id: "short-right-block",
    startZ: -35,
    speed: 5,
    width: 26,
    height: 2.2,
    centerX: 12,
    phaseOffsetMs: 2200,
  },
  {
    id: "short-xtra-block-a",
    startZ: -35,
    speed: 12,
    width: 10,
    height: 2.2,
    centerX: Math.random() * 24 - 12,
    phaseOffsetMs: 2200,
  },
  {
    id: "short-xtra-block-b",
    startZ: -35,
    speed: 12,
    width: 9,
    height: 2.2,
    centerX: Math.random() * 24 - 12,
    phaseOffsetMs: 3300,
  },
];

const ROUND_DURATION_SECONDS = 30;
const TOTAL_ROUNDS = 30;
const ROUND_SPEED_MULTIPLIER_MAX = 5.2;
const PRESSURE_PHASE_REDUCTION_MAX = 0.7;
const ROUND_CURVE_EXPONENT = 1.35;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getRoundProgress = (round: number) => {
  const normalized = (round - 1) / (TOTAL_ROUNDS - 1);
  return clamp(Math.pow(clamp(normalized, 0, 1), ROUND_CURVE_EXPONENT), 0, 1);
};

const getSpeedMultiplierForRound = (round: number) => {
  const progress = getRoundProgress(round);
  return 1 + progress * (ROUND_SPEED_MULTIPLIER_MAX - 1);
};

const getPhaseScaleForRound = (round: number) => {
  const progress = getRoundProgress(round);
  return 1 - progress * PRESSURE_PHASE_REDUCTION_MAX;
};

const getPressureWaveCountForRound = (round: number) => {
  if (round >= 24) return 3;
  if (round >= 12) return 2;
  return 1;
};

function MovingObstacle({
  startZ,
  speed,
  width,
  height,
  centerX: initialX,
  phaseOffsetMs = 0,
  round,
}: {
  startZ: number;
  speed: number;
  width: number;
  height: number;
  centerX: number;
  phaseOffsetMs?: number;
  round: number;
}) {
  const rbRef = useRef<any>(null);
  const elapsedMsRef = useRef(0);
  const currentX = useRef(initialX);

  const speedMultiplier = getSpeedMultiplierForRound(round);
  const phaseScale = getPhaseScaleForRound(round);
  const scaledSpeed = speed * speedMultiplier;
  const scaledPhaseOffsetMs = phaseOffsetMs * phaseScale;

  // Dynamischer HSL-Farbeffekt basierend auf Geschwindigkeit
  const obstacleColor = useMemo(() => {
    const minSpeed = 5;
    const maxSpeed = 55; // clamp max to 55 for nice color transition
    const progress = Math.max(0, Math.min(1, (scaledSpeed - minSpeed) / (maxSpeed - minSpeed)));
    
    // Interpolate hue from 200 (light blue/cyan) to 345 (pink/red)
    const hue = 200 + progress * 145; // 200 to 345
    
    const color = new THREE.Color().setHSL(hue / 360, 1.0, 0.5);
    
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      hex: "#" + color.getHexString(),
    };
  }, [scaledSpeed]);

  useFrame((_, delta) => {
    if (!rbRef.current) return;

    elapsedMsRef.current += delta * 1000;
    if (elapsedMsRef.current < scaledPhaseOffsetMs) return;

    const currentPos = rbRef.current.translation();
    let nextZ = currentPos.z + scaledSpeed * delta;

    if (nextZ > OBSTACLE_Z_MAX) {
      nextZ = OBSTACLE_Z_MIN;
      currentX.current = Math.random() * 24 - 12;

      rbRef.current.setTranslation(
        { x: currentX.current, y: OBSTACLE_BASE_Y, z: nextZ },
        true,
      );
    } else {
      rbRef.current.setNextKinematicTranslation({
        x: currentX.current,
        y: OBSTACLE_BASE_Y,
        z: nextZ,
      });
    }
  });

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      // WICHTIG: colliders="false", weil wir den Collider jetzt manuell setzen.
      // So können wir die Optik verändern, ohne dass Rapier die Hitbox kaputt macht.
      colliders={false}
      position={[currentX.current, OBSTACLE_BASE_Y, startZ]}
      friction={0}
      restitution={0}
    >
      {/* 1. DIE UNSICHTBARE HITBOX (Exakt wie vorher) */}
      <CuboidCollider args={[width / 2, height / 2, OBSTACLE_DEPTH / 2]} />

      {/* 2. DIE NEUE OPTIK: Eine leuchtende Cyber-Schranke */}
      <group position={[0, height / 2, 0]}>
        {/* Der innere helle Energiekern */}
        <mesh>
          <boxGeometry args={[width, height * 0.4, OBSTACLE_DEPTH * 0.4]} />
          {/* toneMapped={false} verhindert, dass ThreeJS die Farbe abdunkelt. 
              Werte über 1 bringen es (besonders mit Bloom) zum Leuchten! */}
          <meshBasicMaterial 
            color={[obstacleColor.r * 5, obstacleColor.g * 5, obstacleColor.b * 5]} 
            toneMapped={false} 
          />
        </mesh>

        {/* Die äußere, leicht transparente Hülle */}
        <mesh>
          <boxGeometry
            args={[width + 0.2, height * 0.6, OBSTACLE_DEPTH * 0.6]}
          />
          <meshBasicMaterial
            color={[obstacleColor.r, obstacleColor.g, obstacleColor.b]}
            transparent
            opacity={0.4}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Ein paar digitale Funken/Energiepartikel, die die Barriere umgeben */}
        <Sparkles
          count={40 * (width / 10)} // Je breiter, desto mehr Partikel
          scale={[width + 1, height + 1, OBSTACLE_DEPTH + 2]}
          size={4}
          speed={0.4}
          color={obstacleColor.hex}
        />
      </group>
    </RigidBody>
  );
}

function PuffMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.scale.addScalar(delta * 4);
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.Material).opacity = Math.max(
          0,
          (meshRef.current.material as THREE.Material).opacity - delta * 2,
        );
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  );
}

function FlyingBottle({
  start,
  target,
}: {
  start: [number, number, number];
  target: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTime = useMemo(() => Date.now(), []);
  const DURATION = 1200; // ms
  const PEAK_HEIGHT = 6; // units

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = Date.now() - startTime;
    const t = Math.min(1.0, elapsed / DURATION);

    const x = start[0] + (target[0] - start[0]) * t;
    const z = start[2] + (target[2] - start[2]) * t;
    const linearY = start[1] + (target[1] - start[1]) * t;

    const parabola = 4 * PEAK_HEIGHT * t * (1 - t);
    const y = linearY + parabola;

    meshRef.current.position.set(x, y, z);
    meshRef.current.rotation.x = t * Math.PI * 6;
    meshRef.current.rotation.y = t * Math.PI * 4;
  });

  return (
    <mesh ref={meshRef} castShadow>
      <cylinderGeometry args={[0.1, 0.12, 0.5, 8]} />
      <meshStandardMaterial
        color="#00ff88"
        emissive="#00ff88"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

function ExplosionEffect({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTime = useMemo(() => Date.now(), []);
  const DURATION = 1000; // ms

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = Date.now() - startTime;
    const t = Math.min(1.0, elapsed / DURATION);

    const size = 1 + t * 4;
    meshRef.current.scale.set(size, size, size);

    if (meshRef.current.material) {
      (meshRef.current.material as THREE.Material).opacity = Math.max(
        0,
        1 - t,
      );
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ff7700"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <Sparkles
        count={40}
        scale={4}
        size={5}
        speed={3}
        color="#ffaa00"
      />
    </group>
  );
}

function DummyPlayer({
  position: initialPosition,
  avatar,
  username,
  socket,
}: {
  position: [number, number, number];
  avatar: string;
  username: string;
  socket: Socket | null;
}) {
  const rigidBodyRef = useRef<any>(null);
  const modelRef = useRef<THREE.Group>(null);
  const [currentAnim, setCurrentAnim] = useState("Idle_1");
  const knockbackTime = useRef(0);
  const drunkUntil = useRef(0);

  useEffect(() => {
    if (!socket) return;
    const handleExplosionImpact = ({
      targetPosition,
      radius,
      force,
    }: {
      targetPosition: [number, number, number];
      radius: number;
      force: number;
    }) => {
      if (!rigidBodyRef.current) return;
      const pos = rigidBodyRef.current.translation();
      const dx = pos.x - targetPosition[0];
      const dy = pos.y - targetPosition[1];
      const dz = pos.z - targetPosition[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius) {
        let dirX = dx;
        let dirZ = dz;
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
        if (len > 0) {
          dirX /= len;
          dirZ /= len;
        } else {
          dirX = Math.random() - 0.5;
          dirZ = Math.random() - 0.5;
        }

        const falloff = 1 - dist / radius;
        const finalForce = force * falloff;

        rigidBodyRef.current.setLinvel(
          {
            x: dirX * finalForce,
            y: 9 * 1.5 * falloff,
            z: dirZ * finalForce,
          },
          true,
        );

        knockbackTime.current = Date.now() + 1500;
        drunkUntil.current = Date.now() + 8000;
      }
    };

    socket.on("explosion_impact", handleExplosionImpact);
    return () => {
      socket.off("explosion_impact", handleExplosionImpact);
    };
  }, [socket]);

  useFrame(() => {
    if (!rigidBodyRef.current || !modelRef.current) return;
    const now = Date.now();
    const isLockedByKnockback = now < knockbackTime.current;
    const isDrunk = now < drunkUntil.current;
    const velocity = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();

    let nextAnim = "Idle_1";
    if (isLockedByKnockback) {
      nextAnim = "FreeFalling";
    } else if (isDrunk) {
      nextAnim = "drunk_2";
    } else if (velocity.y < -4) {
      nextAnim = "FreeFalling";
    }

    if (nextAnim !== currentAnim) {
      setCurrentAnim(nextAnim);
    }

    if (pos.y < -5) {
      rigidBodyRef.current.setTranslation(
        { x: initialPosition[0], y: initialPosition[1] + 5, z: initialPosition[2] },
        true,
      );
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      drunkUntil.current = 0;
      knockbackTime.current = 0;
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={initialPosition}
      mass={1}
      type="dynamic"
      enabledRotations={[false, false, false]}
      friction={1}
    >
      <group ref={modelRef}>
        <Player
          currentAction={currentAnim}
          position={[0, -0.92, 0]}
          avatar={avatar}
        />
        <DreiHtml distanceFactor={12} position={[0, 1.2, 0]} center>
          <div className="bg-black/90 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-gray-600 whitespace-nowrap uppercase shadow-lg">
            🤖 {username} (Dummy)
          </div>
        </DreiHtml>
      </group>
    </RigidBody>
  );
}

function ArenaScene({
  players,
  onMove,
  onFall,
  status,
  socketId,
  currentRound,
  isSuddenDeath,
  obstaclesEnabled,
  isDevMode,
  socket,
  roomId,
  bottlesCount,
  barrel,
  puffs,
  flyingBottles,
  explosions,
  fightDevMode,
}: {
  players: PlayerState[];
  onMove: (pos: [number, number, number], rot: number, anim: string) => void;
  onFall: () => void;
  status: string;
  socketId: string | null;
  currentRound: number;
  isSuddenDeath: boolean;
  obstaclesEnabled: boolean;
  isDevMode?: boolean;
  socket: Socket | null;
  roomId: string;
  bottlesCount: number;
  barrel: { id: string; position: [number, number, number] } | null;
  puffs: Array<{ id: string; position: [number, number, number] }>;
  flyingBottles: Array<{ id: string; start: [number, number, number]; target: [number, number, number] }>;
  explosions: Array<{ id: string; position: [number, number, number] }>;
  fightDevMode?: boolean;
}) {
  // Lade die Textur (R3F sucht automatisch im /public Ordner)
  const floorTexture = useTexture(
    "https://www.boozedbunnytown.com/media/textures/rocky_trail_02_diff_4k.jpg",
  );
  const grandStandTexture = useTexture(
    "https://www.boozedbunnytown.com/media/textures/ground_v2.webp",
  );

  // Bringe der Textur bei, dass sie sich wiederholen darf
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;

  // Lege fest, wie oft sie sich wiederholt.
  // Bei 20 Breite und 70 Länge ist ein Verhältnis wie 4 zu 14 ein guter Startwert.
  // Wenn die Steine zu groß aussehen, erhöhe diese Zahlen!
  floorTexture.repeat.set(4, 14);

  const activeObstaclePresets = useMemo(() => {
    const waveCount = getPressureWaveCountForRound(currentRound);
    const waveSpacingMs = 900;
    const result: Array<ObstaclePreset & { waveId: number }> = [];

    for (let wave = 0; wave < waveCount; wave += 1) {
      for (const preset of OBSTACLE_PRESETS) {
        result.push({
          ...preset,
          waveId: wave,
          phaseOffsetMs: preset.phaseOffsetMs + wave * waveSpacingMs,
        });
      }
    }

    return result;
  }, [currentRound]);

  const localPlayerState = socketId
    ? players.find((player) => player.id === socketId)
    : undefined;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        castShadow
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
      />
      {/* 
  sunPosition = [X, Y, Z] 
  Y steuert die Höhe der Sonne. Wenn Y nah an 0 ist, bekommst du einen Sonnenuntergang. 
  Wenn Y hoch ist (z.B. 2), hast du Mittagssonne.
*/}
      <Environment preset="sunset" />
      <Sky
        distance={450000}
        sunPosition={[5, 1, 8]}
        inclination={0}
        azimuth={0.25}
      />
      <Gltf
        position={[0, 22, 0]}
        receiveShadow
        scale={120}
        src="https://www.boozedbunnytown.com/media/models/arena_inside.glb"
      />

      <mesh receiveShadow position={[0, -6, 0]}>
        <boxGeometry args={[540, 1, 770]} />
        {/* Hier kommt die Textur drauf! */}
        <meshStandardMaterial map={grandStandTexture} />
      </mesh>

      {/* 1. wenn DEBUG MODUS = Zeigt alle Physik-Boxen als rote Linien an */}
      <Physics gravity={[0, -9.81, 0]} timeStep="vary" /* debug */>
        {!isSuddenDeath && (
          <group position={[0, -2, 0]}>
            {/* 1. DIE PHYSIK (Unsichtbar) */}

            {/*  <RigidBody type="fixed">

            <mesh  receiveShadow position={[0, 0, 0]}>

              <boxGeometry args={[36, 2.3, 65]} />

              <meshStandardMaterial map={grandStandTexture} />

            </mesh>

          </RigidBody> */}

            <RigidBody type="fixed">
              {/* args: [halbe Breite, halbe Höhe, halbe Tiefe] */}
              {/* 10, 0.5, 35 erzeugt eine Box von 20x1x70 Einheiten */}
              <CuboidCollider args={[18.2, 1.4, 33.3]} />
            </RigidBody>

            {/* 2. DIE OPTIK (Keine eigene Physik!) */}
            <Gltf
              src="https://www.boozedbunnytown.com/media/models/podest.glb"
              receiveShadow
              castShadow
              rotation={[0, (90 * Math.PI) / 180, 0]}
              scale={35}
              /* Wichtig: Wenn das Gltf keine Physik haben soll, 
         einfach außerhalb eines RigidBodys platzieren oder 
         im Gltf-onLoad alle Collider entfernen. */
            />
          </group>
        )}

        {obstaclesEnabled &&
          !isDevMode &&
          activeObstaclePresets.map((preset) => (
            <MovingObstacle
              key={`${preset.id}-wave-${preset.waveId}`}
              startZ={preset.startZ}
              speed={preset.speed}
              width={preset.width}
              height={preset.height}
              centerX={preset.centerX}
              phaseOffsetMs={preset.phaseOffsetMs}
              round={currentRound}
            />
          ))}

        {isDevMode && (
          <>
            <OrbitControls makeDefault />
            
            {/* Display all four player avatars side-by-side to compare sizes */}
            <group position={[-4, 1.4, 0]}>
              <Player currentAction="Idle_1" avatar="bunny" />
              <DreiHtml distanceFactor={12} position={[0, 1.8, 0]} center>
                <div className="bg-black/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-brand-primary whitespace-nowrap uppercase tracking-wider shadow-lg">
                  🐰 Bunny
                </div>
              </DreiHtml>
            </group>

            <group position={[-1.3, 1.4, 0]}>
              <Player currentAction="Idle_1" avatar="cowie" />
              <DreiHtml distanceFactor={12} position={[0, 1.8, 0]} center>
                <div className="bg-black/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-brand-primary whitespace-nowrap uppercase tracking-wider shadow-lg">
                  🐮 Cowie
                </div>
              </DreiHtml>
            </group>

            <group position={[1.3, 1.4, 0]}>
              <Player currentAction="Idle_1" avatar="nutty" />
              <DreiHtml distanceFactor={12} position={[0, 1.8, 0]} center>
                <div className="bg-black/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-brand-primary whitespace-nowrap uppercase tracking-wider shadow-lg">
                  🐿️ Nutty
                </div>
              </DreiHtml>
            </group>

            <group position={[4, 1.4, 0]}>
              <Player currentAction="Idle_1" avatar="skunky" />
              <DreiHtml distanceFactor={12} position={[0, 1.8, 0]} center>
                <div className="bg-black/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-brand-primary whitespace-nowrap uppercase tracking-wider shadow-lg">
                  🦨 Skunky
                </div>
              </DreiHtml>
            </group>
          </>
        )}
        {status === "playing" && !isDevMode && (
          <LocalPlayer
            onMove={onMove}
            onFall={onFall}
            initialSpawn={
              localPlayerState
                ? {
                    position: localPlayerState.position,
                    rotation: localPlayerState.rotation,
                    spawnSequence: localPlayerState.spawnSequence,
                  }
                : undefined
            }
            avatar={localPlayerState?.avatar || "bunny"}
            socket={socket}
            roomId={roomId}
            bottlesCount={bottlesCount}
            barrel={barrel}
          />
        )}
        {players
          .filter((p) => p.id !== socketId)
          .map((p) => (
            <RemotePlayer
              key={p.id}
              position={p.position}
              rotation={p.rotation}
              username={p.username}
              anim={p.anim}
              avatar={p.avatar}
            />
          ))}

        {/* Fight DevMode Dummies */}
        {fightDevMode && (
          <>
            <DummyPlayer
              position={[-4, -0.6, 5]}
              avatar="cowie"
              username="Cowie"
              socket={socket}
            />
            <DummyPlayer
              position={[4, -0.6, 5]}
              avatar="nutty"
              username="Nutty"
              socket={socket}
            />
            <DummyPlayer
              position={[0, -0.6, -10]}
              avatar="skunky"
              username="Skunky"
              socket={socket}
            />
          </>
        )}
      </Physics>

      {/* Active Barrel (Multiplayer only) */}
      {status === "playing" && !isDevMode && !roomId.startsWith("solo-") && barrel && (
        <group position={barrel.position}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.55, 1.3, 16]} />
            <meshStandardMaterial
              color="#b5651d"
              roughness={0.7}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.04, 8, 24]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
          <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.04, 8, 24]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
          <Sparkles count={15} scale={1.5} size={2} color="#00ffff" speed={0.5} />
        </group>
      )}

      {/* Barrel Claim Puffs */}
      {puffs.map((puff) => (
        <group key={puff.id} position={puff.position}>
          <Sparkles
            count={30}
            scale={2.0}
            size={6}
            speed={2.5}
            color="#00ffff"
          />
          <PuffMesh />
        </group>
      ))}

      {/* Flying Bottles */}
      {flyingBottles.map((fb) => (
        <FlyingBottle key={fb.id} start={fb.start} target={fb.target} />
      ))}

      {/* Explosions */}
      {explosions.map((exp) => (
        <ExplosionEffect key={exp.id} position={exp.position} />
      ))}
    </>
  );
}

export default function ArenaPage({
  params,
}: {
  params: Promise<{ gameRoomId: string }>;
}) {
  const { gameRoomId } = use(params);
  const isDevMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("devMode") === "true";
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<{
    players: PlayerState[];
    obstacles: Obstacle[];
    status: "waiting" | "playing" | "finished";
    startedAtMs?: number;
    roundIndex?: number;
    roundPhase?: string;
    phaseStartTimeMs?: number;
    phaseDurationMs?: number;
    obstaclesEnabled?: boolean;
    nextActiveStartTimeMs?: number;
    gameOver?: GameOverPayload;
    barrel?: { id: string; position: [number, number, number] } | null;
  }>({ players: [], obstacles: [], status: "waiting" });

  const [puffs, setPuffs] = useState<Array<{ id: string; position: [number, number, number] }>>([]);
  const [flyingBottles, setFlyingBottles] = useState<Array<{ id: string; start: [number, number, number]; target: [number, number, number] }>>([]);
  const [explosions, setExplosions] = useState<Array<{ id: string; position: [number, number, number] }>>([]);

  const addPuff = (position: [number, number, number]) => {
    const id = `puff-${Math.random().toString(36).substring(2, 7)}`;
    setPuffs((prev) => [...prev, { id, position }]);
    setTimeout(() => {
      setPuffs((prev) => prev.filter((p) => p.id !== id));
    }, 800);
  };

  const addFlyingBottle = (start: [number, number, number], target: [number, number, number]) => {
    const id = `bottle-${Math.random().toString(36).substring(2, 7)}`;
    setFlyingBottles((prev) => [...prev, { id, start, target }]);
    setTimeout(() => {
      setFlyingBottles((prev) => prev.filter((b) => b.id !== id));
    }, 1200);
  };

  const addExplosion = (position: [number, number, number]) => {
    const id = `explosion-${Math.random().toString(36).substring(2, 7)}`;
    setExplosions((prev) => [...prev, { id, position }]);
    setTimeout(() => {
      setExplosions((prev) => prev.filter((e) => e.id !== id));
    }, 1000);
  };
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [entryPhase, setEntryPhase] = useState<ArenaEntryPhase>("boot");
  const [roundNowMs, setRoundNowMs] = useState(Date.now());

  useEffect(() => {
    if (gameState.status !== "playing") {
      return;
    }

    const interval = setInterval(() => {
      setRoundNowMs(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [gameState.status]);

  const startedAtMs = gameState.startedAtMs ?? roundNowMs;
  const authoritativePhase =
    gameState.roundPhase && typeof gameState.roundIndex === "number"
      ? {
          roundIndex: gameState.roundIndex,
          phase: gameState.roundPhase,
          phaseStartTimeMs: gameState.phaseStartTimeMs ?? startedAtMs,
          phaseDurationMs:
            gameState.phaseDurationMs ??
            DEFAULT_ROUND_TRANSITION_CONFIG.roundDurationMs,
          obstaclesEnabled: gameState.obstaclesEnabled ?? true,
          nextActiveStartTimeMs: gameState.nextActiveStartTimeMs,
        }
      : getRoundPhaseStateAt(
          roundNowMs,
          startedAtMs,
          DEFAULT_ROUND_TRANSITION_CONFIG,
        );
  const currentRound = clamp(authoritativePhase.roundIndex, 1, TOTAL_ROUNDS);
  const phaseElapsedMs = Math.max(
    0,
    roundNowMs - authoritativePhase.phaseStartTimeMs,
  );
  const roundSecondsRemaining = Math.max(
    0,
    Math.ceil(
      (authoritativePhase.phase === "ACTIVE_ROUND"
        ? Math.max(0, authoritativePhase.phaseDurationMs - phaseElapsedMs)
        : authoritativePhase.nextActiveStartTimeMs
          ? Math.max(0, authoritativePhase.nextActiveStartTimeMs - roundNowMs)
          : authoritativePhase.phaseDurationMs) / 1000,
    ),
  );
  const isApproachingStart =
    (authoritativePhase.phase === "PRE_ROUND_BREATHING" ||
      authoritativePhase.phase === "BETWEEN_ROUND_BREATHING" ||
      authoritativePhase.phase === "ROUND_ANNOUNCE") &&
    roundSecondsRemaining <= 3;
  const isSuddenDeath =
    gameState.status === "playing" && currentRound >= TOTAL_ROUNDS;

  const mode =
    gameState.gameOver?.mode ?? (gameRoomId.startsWith("solo-") ? "SP" : "MP");
  const localPostMatchRows = rankToplistEntries(
    gameState.gameOver?.entries ?? [],
  );
  const roundsReached = gameState.gameOver?.roundsReached ?? currentRound;

  useEffect(() => {
    if (gameState.status !== "finished") {
      return;
    }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    document.body.style.cursor = "auto";

    return () => {
      document.body.style.cursor = "";
    };
  }, [gameState.status]);

  useEffect(() => {
    setEntryPhase("boot");

    const phaseFrame = requestAnimationFrame(() => {
      setEntryPhase("preloading");
    });

    const timeoutHandle = setTimeout(() => {
      setEntryPhase((prev) => (prev === "playing" ? prev : "load_error"));
    }, 8000);

    return () => {
      cancelAnimationFrame(phaseFrame);
      clearTimeout(timeoutHandle);
    };
  }, [gameRoomId]);

  const fightDevMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("fightDevMode") === "true";

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      s.emit("join_arena_room", {
        roomId: gameRoomId,
        cameraYaw: 0,
        fightDevMode: fightDevMode,
      });
    });

    s.on("game_state", (state) => {
      setGameState((prev) => ({ ...prev, ...state }));
    });

    s.on("barrel_claimed", ({ winnerSocketId, puffPosition }: { winnerSocketId: string; puffPosition: [number, number, number] }) => {
      addPuff(puffPosition);
    });

    s.on("bottle_thrown", ({ throwerId, startPosition, targetPosition }: { throwerId: string; startPosition: [number, number, number]; targetPosition: [number, number, number] }) => {
      addFlyingBottle(startPosition, targetPosition);
    });

    s.on("explosion_impact", ({ targetPosition }: { targetPosition: [number, number, number] }) => {
      addExplosion(targetPosition);
    });

    s.on("game_start", ({ players, startedAtMs }) => {
      setRoundNowMs(Date.now());
      setGameState((prev) => ({
        ...prev,
        status: "playing",
        players,
        startedAtMs: typeof startedAtMs === "number" ? startedAtMs : Date.now(),
      }));
    });

    s.on("game_over", (data: GameOverPayload) => {
      setGameState((prev) => ({
        ...prev,
        status: "finished",
        gameOver: data,
      }));

      fetch("/api/me")
        .then((res) => res.json())
        .then((freshUser) => {
          setCurrentUser(freshUser);
        })
        .catch(() => {
          // ignore refresh errors in post-match UI
        });
    });

    s.on("opponent_left", () => {
      setGameState((prev) => ({ ...prev, status: "finished" }));
    });

    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setCurrentUser(data);
      });

    return () => {
      s.disconnect();
    };
  }, [gameRoomId]);

  const handleMove = (
    position: [number, number, number],
    rotation: number,
    anim: string,
  ) => {
    socket?.emit("player_move", {
      roomId: gameRoomId,
      position,
      rotation,
      anim,
    });
  };

  const handleFall = () => {
    if (gameState.status === "playing") {
      socket?.emit("player_fell", { roomId: gameRoomId });
    }
  };

  const handleCanvasCreated = () => {
    if (entryPhase === "load_error") {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEntryPhase("ready_hold");
        setTimeout(() => {
          setEntryPhase((prev) =>
            prev === "ready_hold" ? "fade_out_overlay" : prev,
          );
        }, 300);
        setTimeout(() => {
          setEntryPhase((prev) =>
            prev === "fade_out_overlay" || prev === "ready_hold"
              ? "playing"
              : prev,
          );
        }, 500);
      });
    });
  };

  const handleRetryArenaLoad = () => {
    setEntryPhase("preloading");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEntryPhase("ready_hold");
        setTimeout(() => {
          setEntryPhase((prev) =>
            prev === "ready_hold" ? "fade_out_overlay" : prev,
          );
        }, 300);
        setTimeout(() => {
          setEntryPhase((prev) =>
            prev === "fade_out_overlay" || prev === "ready_hold"
              ? "playing"
              : prev,
          );
        }, 500);
      });
    });
  };

  const showEntryOverlay = entryPhase !== "playing" && !isDevMode;
  const localPlayerState = socket
    ? gameState.players.find((player) => player.id === socket.id)
    : undefined;

  return (
    <main className="flex min-h-screen flex-col bg-[#05010a] text-white font-sans overflow-hidden relative">
      <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="relative group">
          <div className="absolute inset-0 bg-brand-primary/20 blur-xl group-hover:bg-brand-primary/30 transition-all" />
          <div className=" bg-black/60 backdrop-blur-md border-l-4 border-brand-primary px-6 py-4 relative">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-primary/10 flex items-center justify-center border border-brand-primary/30">
                <Swords className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary/70">
                  Sector ID
                </h2>
                <p className="font-mono text-white font-black text-lg leading-none">
                  {gameRoomId.split("-")[0].toUpperCase()}
                  <span className="text-brand-primary opacity-50">
                    -{gameRoomId.split("-")[1] || "X"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {gameState.status === "playing" && !isDevMode && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-secondary/5 blur-lg" />
              <div className="bg-black/40 backdrop-blur-xl px-10 py-2 border-y border-brand-secondary/30 relative">
                <div className="absolute left-0 top-0 w-2 h-full bg-brand-secondary" />
                <div className="absolute right-0 top-0 w-2 h-full bg-brand-secondary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-secondary animate-pulse">
                  {authoritativePhase.phase === "ACTIVE_ROUND"
                    ? "Round Active"
                    : "Recalibrating"}
                </span>
              </div>
            </div>

            <div className="flex gap-1">
              <div
                className={` ${isSuddenDeath ? "bg-red-600/80" : "bg-brand-primary/80"} px-8 py-3 relative`}
              >
                <p className="text-[10px] font-bold uppercase text-white/70 tracking-widest text-center">
                  Cycle
                </p>
                <p className="text-2xl font-black text-white leading-none">
                  {currentRound}
                  <span className="text-xs opacity-50 ml-1">
                    / {TOTAL_ROUNDS}
                  </span>
                </p>
              </div>
              <div className=" bg-white/10 backdrop-blur-md px-8 py-3 border-r border-white/20">
                <p className="text-[10px] font-bold uppercase text-white/50 tracking-widest text-center">
                  Time
                </p>
                <p className="text-2xl font-mono font-black text-brand-secondary leading-none">
                  {String(Math.floor(roundSecondsRemaining / 60)).padStart(
                    2,
                    "0",
                  )}
                  :{String(roundSecondsRemaining % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 items-start">
          {!isDevMode && (
            <div className=" bg-white/5 backdrop-blur-md px-6 py-4 border-r border-brand-primary/30">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-brand-primary" />
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                    Nodes
                  </p>
                  <p className="text-sm font-black font-mono">
                    0{gameState.players.length}
                    <span className="opacity-30">
                      /0{gameRoomId.startsWith("solo-") ? "1" : "2"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => router.push("/")}
            className="group relative pointer-events-auto"
          >
            <div className="absolute inset-0 bg-red-500/20 blur group-hover:bg-red-500/40 transition-all" />
            <div className=" bg-red-950/40 border border-red-500/50 px-6 py-4 transition-all group-hover:translate-x-1 group-hover:-translate-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                Abort Mission
              </span>
            </div>
          </button>
        </div>
      </div>

      {gameState.status === "playing" &&
        authoritativePhase.phase !== "ACTIVE_ROUND" &&
        !isDevMode && (
          <div className="absolute inset-x-0 top-1/3 z-20 pointer-events-none">
            <div className="relative h-32 w-full flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-brand-primary/10 backdrop-blur-sm skew-y-1" />
              <div className="absolute inset-y-0 left-0 w-24 bg-brand-primary" />
              <div className="absolute inset-y-0 right-0 w-24 bg-brand-primary" />

              <div className="relative flex flex-col items-center">
                <div className="flex items-center gap-8">
                  <div className="h-[2px] w-32 bg-gradient-to-r from-transparent to-brand-primary" />
                  <span className="text-xs font-black uppercase tracking-[0.8em] text-brand-primary">
                    Prepare for link
                  </span>
                  <div className="h-[2px] w-32 bg-gradient-to-l from-transparent to-brand-primary" />
                </div>
                <h1
                  className="text-7xl font-heading font-black text-white italic tracking-tighter cyber-glitch-text"
                  data-text={`CYCLE_0${currentRound}`}
                >
                  CYCLE_0{currentRound}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-brand-secondary animate-ping" />
                  <span className="text-[10px] font-mono font-bold text-brand-secondary uppercase">
                    Broadcasting Obstacle Data...
                  </span>
                </div>
              </div>

              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-px bg-white/20 animate-pulse" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-px bg-white/20 animate-pulse" />
            </div>
          </div>
        )}

      {gameState.status === "playing" &&
        authoritativePhase.phase !== "ACTIVE_ROUND" &&
        !isDevMode && (
          <div
            className={`pointer-events-none transition-all duration-500 z-50 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-black ${isApproachingStart ? "text-[12rem] text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "text-8xl text-brand-secondary opacity-70"}`}
          >
            {roundSecondsRemaining}
          </div>
        )}

      {gameState.status === "waiting" &&
        !gameRoomId.startsWith("solo-") &&
        !isDevMode &&
        !fightDevMode && (
          <div
            id="waiting-overlay"
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md transition-colors duration-200 ${entryPhase === "playing" ? "bg-[#05010a]/90" : "bg-[#05010a]"}`}
          >
            <div className="max-w-md w-full px-6">
              <div className="cyber-border bg-black/80 p-8 rounded-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-brand-primary/20 flex items-center justify-center border border-brand-primary/50">
                    <Users className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h2
                      className="text-2xl font-heading font-bold tracking-tighter cyber-glitch-text"
                      data-text="AWAITING OPPONENT"
                    >
                      AWAITING OPPONENT
                    </h2>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-brand-primary/60 font-bold">
                      Establishing Secure Link...
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="h-1 bg-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-brand-primary animate-[cyber-loading_2s_infinite]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>PING: 24MS</span>
                    <span className="animate-pulse">ENCRYPTING...</span>
                    <span>SSL: ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {gameState.status === "finished" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05010a]/95 backdrop-blur-xl animate-in fade-in duration-700 text-center p-6">
          {!currentUser ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-t-2 border-brand-primary rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-[0.4em] text-brand-primary">
                Finalizing Session...
              </p>
            </div>
          ) : (
            <div className="w-full max-w-4xl relative">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-full flex flex-col items-center">
                <h1 className="text-8xl font-heading font-black italic tracking-tighter opacity-10 absolute top-0">
                  DEBRIEFING
                </h1>
                <div
                  className="cyber-glitch-text text-5xl font-heading font-black tracking-tighter text-white mt-12 mb-4"
                  data-text={mode === "SP" ? "Game Over" : "Match Finished"}
                >
                  {mode === "SP" ? "Game Over" : "Match Finished"}
                </div>
                <div className="w-32 h-1 bg-brand-primary" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                <div className="cyber-border bg-black/60 p-6 flex flex-col items-center justify-center min-h-[160px]">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    Efficiency
                  </p>
                  <p className="text-5xl font-heading font-black text-white italic">
                    {roundsReached}
                  </p>
                  <p className="text-[10px] font-bold text-brand-primary uppercase mt-1">
                    Cycles Completed
                  </p>
                </div>

                <div className="md:col-span-2 cyber-border bg-brand-primary/5 p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy className="w-32 h-32 text-brand-primary" />
                  </div>

                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-4">
                      Mission Performance
                    </p>

                    {mode === "MP" ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-white/10 pb-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">
                            Primary Node
                          </span>
                          <span className="text-xl font-black text-white">
                            {currentUser.username}
                          </span>
                        </div>
                        <div className="flex justify-between items-end border-b border-white/10 pb-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">
                            Operational Status
                          </span>
                          <span
                            className={`text-xl font-black ${gameState.gameOver?.winner === currentUser.username ? "text-green-500" : "text-red-500"}`}
                          >
                            {gameState.gameOver?.winner === currentUser.username
                              ? "STILL STANDING"
                              : "NEURAL TERMINATED"}
                          </span>
                        </div>
                        {gameState.gameOver?.winner ===
                          currentUser.username && (
                          <div className="pt-2">
                            <div className="inline-block bg-brand-secondary/20 border border-brand-secondary/40 px-4 py-2 skew-x-[-15deg]">
                              <span className="text-brand-secondary font-black text-sm tracking-tighter">
                                +
                                {gameState.gameOver.reward?.toLocaleString() ||
                                  0}{" "}
                                BBT CREDITS ISSUED
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-gray-300 text-sm leading-relaxed max-w-md">
                          Neural synchronization sustained for {roundsReached}{" "}
                          cycles. Performance data uploaded to the central grid.
                          Keep training to increase your BBT yield potential.
                        </p>
                        <div className="h-px w-full bg-white/5 mt-4" />
                        <div className="flex gap-4 mt-4 text-[10px] font-mono text-gray-500">
                          <span>RANK: B+</span>
                          <span>STABILITY: 98.4%</span>
                          <span>YIELD: N/A (TRAINING)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {mode === "MP" && (
                  <ArenaGlobalToplist
                    currentUserUsername={currentUser?.username}
                    localPostMatchRows={localPostMatchRows}
                    personalMaxRounds={currentUser?.arenaMaxRounds}
                  />
                )}
              </div>

              <div className="mt-12 flex justify-center gap-6">
                <button
                  onClick={() => router.push("/")}
                  className="group relative pointer-events-auto"
                >
                  <div className="absolute inset-0 bg-brand-primary/30 blur group-hover:bg-brand-primary/50 transition-all" />
                  <div className=" bg-brand-primary px-12 py-4 relative transition-transform group-active:scale-95">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-white">
                      Return to Simulation
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="absolute inset-0 bg-[#05010a]" />}>
          <KeyboardControls map={keyboardMap}>
            <Canvas
              className="select-none"
              shadows
              onCreated={handleCanvasCreated}
            >
              <ArenaScene
                players={gameState.players}
                onMove={handleMove}
                onFall={handleFall}
                status={gameState.status}
                socketId={socket?.id || null}
                currentRound={currentRound}
                isSuddenDeath={isSuddenDeath}
                obstaclesEnabled={authoritativePhase.obstaclesEnabled}
                isDevMode={isDevMode}
                socket={socket}
                roomId={gameRoomId}
                bottlesCount={localPlayerState?.bottlesCount ?? 0}
                barrel={gameState.barrel || null}
                puffs={puffs}
                flyingBottles={flyingBottles}
                explosions={explosions}
                fightDevMode={fightDevMode}
              />
            </Canvas>
          </KeyboardControls>
        </Suspense>

        {showEntryOverlay && (
          <div
            className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#05010a] transition-opacity duration-500 ${entryPhase === "fade_out_overlay" ? "opacity-0" : "opacity-100"}`}
          >
            {entryPhase === "load_error" ? (
              <div className="cyber-border bg-black/60 p-10 max-w-sm text-center">
                <h2 className="text-2xl font-heading font-bold mb-2 text-red-500">
                  SYSTEM FAILURE
                </h2>
                <p className="text-gray-400 mb-6 text-sm">
                  COULD NOT SYNCHRONIZE ARENA PARAMETERS
                </p>
                <button
                  onClick={handleRetryArenaLoad}
                  className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-500 font-bold uppercase tracking-widest transition-all pointer-events-auto"
                >
                  Reboot System
                </button>
              </div>
            ) : (
              <div className="relative flex flex-col items-center">
                <div className="mb-8 relative">
                  <div className="w-32 h-32 border border-brand-primary/30 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-0 border-t-2 border-brand-primary rounded-full animate-spin" />
                  <div className="absolute inset-4 border border-brand-secondary/20 rounded-full animate-[spin_5s_linear_infinite_reverse]" />
                  <Swords className="absolute inset-0 m-auto w-10 h-10 text-brand-primary animate-pulse" />
                </div>
                <h2
                  className="text-4xl font-heading font-black tracking-tighter mb-2 cyber-glitch-text"
                  data-text="INITIALIZING"
                >
                  INITIALIZING
                </h2>
                <div className="w-64 h-[2px] bg-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-brand-secondary animate-[cyber-loading_1.5s_infinite]" />
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-[0.5em] text-gray-500 font-bold mb-8">
                  Loading Neural Assets
                </p>

                {gameState.players.length > 0 && (
                  <div className="flex gap-8 items-center justify-center pt-8 border-t border-brand-primary/20 w-full max-w-2xl">
                    {gameState.players.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-col items-center gap-3 relative group"
                      >
                        <div className="w-16 h-16 relative border border-white/10  bg-black/40 p-1">
                          <img
                            src={`https://www.boozedbunnytown.com/media/avatars/${p.avatar || "bunny"}_avatar.webp`}
                            alt={p.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-secondary bg-black/80 px-2 py-1">
                          {p.username}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Throwable Ammo HUD */}
      {gameState.status === "playing" && !isDevMode && !gameRoomId.startsWith("solo-") && (
        <div className="absolute bottom-8 left-8 z-10 pointer-events-none flex flex-col gap-2">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-sm shadow-2xl relative overflow-hidden group">
            {/* Glowing accent line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand-secondary to-transparent" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-secondary/15 flex items-center justify-center border border-brand-secondary/30 relative">
                <span className="text-2xl animate-pulse">🧪</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-secondary/80">
                  Alcoholic Ammo
                </h3>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-white font-black text-3xl leading-none">
                    {localPlayerState?.bottlesCount ?? 0}
                  </p>
                  <div className="flex gap-1.5">
                    {[1, 2].map((i) => {
                      const active = (localPlayerState?.bottlesCount ?? 0) >= i;
                      return (
                        <div
                          key={i}
                          className={`w-3 h-6 border transition-all duration-300 ${
                            active
                              ? "bg-brand-secondary border-brand-secondary shadow-[0_0_10px_rgba(0,255,136,0.6)]"
                              : "bg-white/5 border-white/10"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isDevMode && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4 pointer-events-none">
          <div className=" bg-black/60 backdrop-blur-xl px-8 py-3 border-b-2 border-brand-primary/50 flex items-center gap-6">
            <div className="flex gap-2">
              {["W", "A", "S", "D"].map((k) => (
                <div
                  key={k}
                  className="w-9 h-9 bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-brand-secondary skew-x-[-10deg]"
                >
                  {k}
                </div>
              ))}
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-brand-primary/20 border border-brand-primary/40 text-[10px] font-black text-brand-primary skew-x-[-10deg]">
                SPACE
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Jump
              </span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-brand-secondary/20 border border-brand-secondary/40 text-[10px] font-black text-brand-secondary skew-x-[-10deg]">
                SHIFT
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Run
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-brand-secondary/20 border border-brand-secondary/40 text-[10px] font-black text-brand-secondary skew-x-[-10deg]">
                ESC
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Cursor
              </span>
            </div>
          </div>
          <div className="flex gap-2 opacity-30">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-12 h-[2px] bg-brand-primary" />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
