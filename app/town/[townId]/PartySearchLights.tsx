import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function PartySearchlights({ position = [0, 0, 0], scale = 1 }: { position?: [number, number, number], scale?: number }) {
  const lightsRef = useRef<THREE.Group>(null);

  // Shader for the soft, fading light beam (Fake Volumetrics)
  const beamMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color1: { value: new THREE.Color("#BD00FF") }, // Brand Primary (Purple)
        color2: { value: new THREE.Color("#FFB800") }, // Brand Secondary (Gold/Yellow)
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec2 vUv;
        
        void main() {
          // vUv.y goes from 0 (bottom) to 1 (top) on the cylinder
          // Fade it out smoothly towards the top
          float intensity = pow(1.0 - vUv.y, 1.5); 
          
          // Mix colors slightly for a cool neon effect
          vec3 finalColor = mix(color1, color2, vUv.x);
          
          // Apply intensity and base opacity
          gl_FragColor = vec4(finalColor, intensity * 0.4); 
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // Crucial! Prevents clipping issues with your 2D building sprites
      side: THREE.DoubleSide
    });
  }, []);

  // Adjust geometry so the pivot point is at the bottom
  const beamGeometry = useMemo(() => {
    // Cylinder: Top radius, Bottom radius, Height, RadialSegments, HeightSegments, OpenEnded
    const geo = new THREE.CylinderGeometry(2, 0.05, 25, 32, 1, true);
    // Shift up by half height so the origin (0,0,0) is exactly at the bottom tip
    geo.translate(0, 12.5, 0); 
    return geo;
  }, []);

  // Animate the sweeping motion
  useFrame((state) => {
    if (!lightsRef.current) return;
    const t = state.clock.getElapsedTime();
    
    lightsRef.current.children.forEach((light, i) => {
      // Offset each light so they don't move identically
      const offset = i * Math.PI * 0.8;
      
      // Sine wave rotation for the classic sweeping effect
      light.rotation.x = Math.sin(t * 0.7 + offset) * 0.35;
      light.rotation.z = Math.cos(t * 0.5 + offset) * 0.35;
    });
  });

  return (
    <group ref={lightsRef} position={position} scale={scale}>
      <mesh geometry={beamGeometry} material={beamMaterial} position={[-3.87, 0, 0.37]} />
      <mesh geometry={beamGeometry} material={beamMaterial} position={[-3.87, 0, 0.37]} />
      {/* <mesh geometry={beamGeometry} material={beamMaterial} position={[0, 0, 1]} />
      <mesh geometry={beamGeometry} material={beamMaterial} position={[-1, 0, 2]} /> */}
    </group>
  );
}