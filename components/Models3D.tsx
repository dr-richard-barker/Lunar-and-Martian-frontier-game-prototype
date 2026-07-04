import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BuildingType } from '../types';

/**
 * WebGL building models — stylized chunky geometry with PBR materials and
 * strong emissives (picked up by the bloom pass). Identity accents (window
 * bands, rings, rover chassis, rails) take each faction's color; functional
 * glows (ice drills, ore melt, He-3 cores) stay universal.
 */

// --- Shared materials (created once) ---

export const MATS = {
  hull: new THREE.MeshStandardMaterial({ color: '#dde5ee', roughness: 0.4, metalness: 0.15 }),
  hullDark: new THREE.MeshStandardMaterial({ color: '#8a97a8', roughness: 0.5, metalness: 0.3 }),
  foil: new THREE.MeshStandardMaterial({ color: '#d99a2b', roughness: 0.32, metalness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ color: '#5d6b7d', roughness: 0.45, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1b2330', roughness: 0.7, metalness: 0.4 }),
  hazard: new THREE.MeshStandardMaterial({ color: '#f0b429', roughness: 0.6, metalness: 0.1 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#9fd7f2', roughness: 0.12, metalness: 0.1,
    transparent: true, opacity: 0.45, emissive: '#1d7fb8', emissiveIntensity: 0.25,
  }),
  panel: new THREE.MeshStandardMaterial({
    color: '#1d4ed8', roughness: 0.25, metalness: 0.55,
    emissive: '#1e40af', emissiveIntensity: 0.35,
  }),
  neonCyan: new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#22d3ee', emissiveIntensity: 2.6, toneMapped: false }),
  neonViolet: new THREE.MeshStandardMaterial({ color: '#a78bfa', emissive: '#8b5cf6', emissiveIntensity: 2.8, toneMapped: false }),
  neonOrange: new THREE.MeshStandardMaterial({ color: '#fb923c', emissive: '#f97316', emissiveIntensity: 2.4, toneMapped: false }),
  neonGreen: new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#22c55e', emissiveIntensity: 2.2, toneMapped: false }),
  neonRed: new THREE.MeshStandardMaterial({ color: '#f87171', emissive: '#ef4444', emissiveIntensity: 2.6, toneMapped: false }),
  growLight: new THREE.MeshStandardMaterial({
    color: '#f0abfc', emissive: '#d946ef', emissiveIntensity: 1.4,
    transparent: true, opacity: 0.85, toneMapped: false,
  }),
};

/** Faction identity materials, cached per color. */
export interface AccentMats {
  neon: THREE.MeshStandardMaterial;
  soft: THREE.MeshStandardMaterial;
  chassis: THREE.MeshStandardMaterial;
}
const accentCache = new Map<string, AccentMats>();
export function getAccent(color: string): AccentMats {
  const cached = accentCache.get(color);
  if (cached) return cached;
  const mats: AccentMats = {
    neon: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.6, toneMapped: false }),
    soft: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, toneMapped: false }),
    chassis: new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 }),
  };
  accentCache.set(color, mats);
  return mats;
}
export const DEFAULT_ACCENT = getAccent('#22d3ee');

const B = ({ args, mat, p, r, cast = true }: {
  args: [number, number, number];
  mat: THREE.Material;
  p?: [number, number, number];
  r?: [number, number, number];
  cast?: boolean;
}) => (
  <mesh position={p} rotation={r} material={mat} castShadow={cast} receiveShadow>
    <boxGeometry args={args} />
  </mesh>
);

const Cyl = ({ args, mat, p, r, cast = true }: {
  args: [number, number, number, number];
  mat: THREE.Material;
  p?: [number, number, number];
  r?: [number, number, number];
  cast?: boolean;
}) => (
  <mesh position={p} rotation={r} material={mat} castShadow={cast} receiveShadow>
    <cylinderGeometry args={args} />
  </mesh>
);

const DomeMesh = ({ radius, mat, p, scaleY = 1 }: {
  radius: number;
  mat: THREE.Material;
  p?: [number, number, number];
  scaleY?: number;
}) => (
  <mesh position={p} material={mat} castShadow scale={[1, scaleY, 1]}>
    <sphereGeometry args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
  </mesh>
);

/** Slowly spinning holographic ring. */
const HoloRing = ({ radius, y, mat, speed = 0.6 }: {
  radius: number;
  y: number;
  mat: THREE.Material;
  speed?: number;
}) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.z += delta * speed; });
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <torusGeometry args={[radius, 0.014, 8, 48]} />
    </mesh>
  );
};

/** Blinking beacon light. */
const Beacon = ({ p, mat, period = 1.4 }: { p: [number, number, number]; mat: THREE.Material; period?: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.visible = (clock.elapsedTime % period) < period * 0.55;
  });
  return (
    <mesh ref={ref} position={p} material={mat}>
      <sphereGeometry args={[0.035, 10, 10]} />
    </mesh>
  );
};

/** Pulsing emissive core (drills, reactors). */
const PulseCore = ({ args, p, mat }: { args: [number, number, number, number]; p: [number, number, number]; mat: THREE.Material }) => {
  const ref = useRef<THREE.Mesh>(null);
  const base = useMemo(() => (mat as THREE.MeshStandardMaterial).emissiveIntensity, [mat]);
  const cloned = useMemo(() => (mat as THREE.MeshStandardMaterial).clone(), [mat]);
  useFrame(({ clock }) => {
    const m = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = base * (0.65 + 0.35 * Math.sin(clock.elapsedTime * 3));
  });
  return (
    <mesh ref={ref} position={p} material={cloned}>
      <cylinderGeometry args={args} />
    </mesh>
  );
};

const Truss = ({ s, h, y = 0 }: { s: number; h: number; y?: number }) => (
  <>
    {[[-s, -s], [s, -s], [s, s], [-s, s]].map(([px, pz], i) => (
      <B key={i} args={[0.045, h, 0.045]} mat={MATS.metal} p={[px, y + h / 2, pz]} />
    ))}
    <B args={[s * 2 + 0.05, 0.035, 0.035]} mat={MATS.metal} p={[0, y + h - 0.04, -s]} />
    <B args={[s * 2 + 0.05, 0.035, 0.035]} mat={MATS.metal} p={[0, y + h - 0.04, s]} />
    <B args={[0.035, 0.035, s * 2 + 0.05]} mat={MATS.metal} p={[-s, y + h - 0.04, 0]} />
    <B args={[0.035, 0.035, s * 2 + 0.05]} mat={MATS.metal} p={[s, y + h - 0.04, 0]} />
  </>
);

// --- Buildings (A = faction accent materials) ---

type ModelProps = { A: AccentMats };

const CityModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <Cyl args={[0.82, 0.9, 0.06, 24]} mat={MATS.dark} p={[0, 0.03, 0]} />
    <B args={[0.78, 0.16, 0.78]} mat={MATS.foil} p={[0, 0.14, 0]} />
    <B args={[0.58, 0.24, 0.58]} mat={MATS.hull} p={[0, 0.34, 0]} />
    <B args={[0.6, 0.035, 0.6]} mat={A.neon} p={[0, 0.47, 0]} cast={false} />
    <B args={[0.4, 0.26, 0.4]} mat={MATS.hull} p={[0, 0.62, 0]} />
    <B args={[0.42, 0.035, 0.42]} mat={A.soft} p={[0, 0.76, 0]} cast={false} />
    <Cyl args={[0.14, 0.16, 0.12, 12]} mat={MATS.metal} p={[0, 0.84, 0]} />
    <Cyl args={[0.015, 0.015, 0.34, 6]} mat={MATS.hull} p={[0, 1.05, 0]} />
    <B args={[0.16, 0.02, 0.02]} mat={MATS.hull} p={[0, 1.12, 0]} />
    <Beacon p={[0, 1.24, 0]} mat={MATS.neonRed} />
    <HoloRing radius={0.3} y={1.0} mat={A.neon} />
    <DomeMesh radius={0.2} mat={MATS.glass} p={[-0.42, 0.22, 0.36]} scaleY={0.85} />
    <DomeMesh radius={0.2} mat={MATS.glass} p={[0.42, 0.22, 0.36]} scaleY={0.85} />
    <B args={[0.18, 0.08, 0.14]} mat={MATS.hazard} p={[0, 0.06, -0.42]} />
  </group>
);

const SolarModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.14, 0.12, 0.14]} mat={MATS.foil} p={[-0.28, 0.06, 0]} />
    <B args={[0.14, 0.12, 0.14]} mat={MATS.foil} p={[0.28, 0.06, 0]} />
    <B args={[0.62, 0.04, 0.04]} mat={MATS.metal} p={[0, 0.15, 0]} />
    <B args={[0.42, 0.02, 0.36]} mat={MATS.panel} p={[-0.28, 0.26, 0]} r={[-0.6, 0, 0]} />
    <B args={[0.42, 0.02, 0.36]} mat={MATS.panel} p={[0.28, 0.26, 0]} r={[-0.6, 0, 0]} />
    <B args={[0.42, 0.012, 0.03]} mat={A.neon} p={[-0.28, 0.19, 0.14]} r={[-0.6, 0, 0]} cast={false} />
    <B args={[0.42, 0.012, 0.03]} mat={A.neon} p={[0.28, 0.19, 0.14]} r={[-0.6, 0, 0]} cast={false} />
    <Beacon p={[0, 0.32, -0.24]} mat={MATS.neonGreen} period={3} />
  </group>
);

const HabitatModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <DomeMesh radius={0.44} mat={MATS.hull} p={[0, 0.04, 0]} scaleY={0.8} />
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={A.neon}>
      <torusGeometry args={[0.36, 0.012, 8, 40]} />
    </mesh>
    <B args={[0.2, 0.12, 0.22]} mat={MATS.hull} p={[0, 0.06, 0.46]} />
    <B args={[0.22, 0.13, 0.04]} mat={MATS.hazard} p={[0, 0.065, 0.58]} />
    <Beacon p={[0, 0.42, 0]} mat={A.soft} period={3} />
  </group>
);

const IceExtractorModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.42, 0.12, 0.42]} mat={MATS.dark} p={[0, 0.06, 0]} />
    <B args={[0.44, 0.025, 0.44]} mat={A.neon} p={[0, 0.13, 0]} cast={false} />
    <Truss s={0.16} h={0.52} y={0.12} />
    <PulseCore args={[0.045, 0.045, 0.5, 8]} p={[0, 0.38, 0]} mat={MATS.neonCyan} />
    <Cyl args={[0.12, 0.14, 0.08, 6]} mat={MATS.hull} p={[0, 0.68, 0]} />
  </group>
);

const OxygenatorModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.5, 0.1, 0.32]} mat={MATS.dark} p={[0, 0.05, 0]} />
    <Cyl args={[0.11, 0.11, 0.34, 14]} mat={MATS.hull} p={[-0.14, 0.27, 0]} />
    <Cyl args={[0.11, 0.11, 0.26, 14]} mat={MATS.hull} p={[0.14, 0.23, 0]} />
    <mesh position={[-0.14, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={A.neon}>
      <torusGeometry args={[0.115, 0.012, 8, 24]} />
    </mesh>
    <mesh position={[0.14, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]} material={A.neon}>
      <torusGeometry args={[0.115, 0.012, 8, 24]} />
    </mesh>
    <B args={[0.3, 0.05, 0.05]} mat={MATS.foil} p={[0, 0.16, 0]} />
    <Beacon p={[-0.14, 0.48, 0]} mat={MATS.neonGreen} />
  </group>
);

const GreenhouseModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.68, 0.1, 0.4]} mat={MATS.hull} p={[0, 0.05, 0]} />
    <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={MATS.glass} castShadow>
      <cylinderGeometry args={[0.17, 0.17, 0.62, 16, 1, false, 0, Math.PI]} />
    </mesh>
    <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={MATS.growLight}>
      <cylinderGeometry args={[0.13, 0.13, 0.56, 12, 1, false, 0, Math.PI]} />
    </mesh>
    {[-0.2, 0, 0.2].map(x => (
      <B key={x} args={[0.03, 0.2, 0.42]} mat={MATS.hull} p={[x, 0.14, 0]} />
    ))}
    <B args={[0.68, 0.03, 0.03]} mat={A.soft} p={[0, 0.11, 0.21]} cast={false} />
    <Beacon p={[0.3, 0.2, -0.16]} mat={MATS.neonGreen} period={3} />
  </group>
);

const MiningRigModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.44, 0.1, 0.44]} mat={MATS.dark} p={[0, 0.05, 0]} />
    <B args={[0.46, 0.04, 0.46]} mat={MATS.hazard} p={[0, 0.12, 0]} />
    <Truss s={0.14} h={0.44} y={0.14} />
    <B args={[0.2, 0.16, 0.2]} mat={MATS.foil} p={[0, 0.64, 0]} />
    <B args={[0.44, 0.07, 0.08]} mat={MATS.metal} p={[0.1, 0.5, 0]} />
    <PulseCore args={[0.05, 0.05, 0.24, 8]} p={[0.28, 0.24, 0]} mat={MATS.neonOrange} />
    <Beacon p={[0, 0.78, 0]} mat={A.soft} />
  </group>
);

const He3Model3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <B args={[0.44, 0.1, 0.44]} mat={MATS.dark} p={[0, 0.05, 0]} />
    {[[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]].map(([x, z], i) => (
      <B key={i} args={[0.05, 0.24, 0.05]} mat={MATS.metal} p={[x, 0.22, z]} />
    ))}
    <Cyl args={[0.14, 0.16, 0.28, 12]} mat={MATS.dark} p={[0, 0.24, 0]} />
    <PulseCore args={[0.06, 0.06, 0.44, 10]} p={[0, 0.36, 0]} mat={MATS.neonViolet} />
    <HoloRing radius={0.24} y={0.42} mat={MATS.neonViolet} />
    <HoloRing radius={0.17} y={0.55} mat={A.neon} speed={-0.9} />
  </group>
);

const LaunchPadModel3D: React.FC<ModelProps> = ({ A }) => (
  <group>
    <Cyl args={[0.5, 0.54, 0.05, 24]} mat={MATS.dark} p={[0, 0.025, 0]} />
    <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} material={A.neon}>
      <torusGeometry args={[0.44, 0.012, 8, 48]} />
    </mesh>
    <Truss s={0.07} h={0.6} y={0.05} />
    <group position={[-0.34, 0, -0.24]}>
      <Truss s={0.06} h={0.56} y={0.05} />
      <Beacon p={[0, 0.68, 0]} mat={MATS.neonRed} />
    </group>
    <Cyl args={[0.1, 0.11, 0.4, 14]} mat={MATS.hull} p={[0, 0.25, 0]} />
    <Cyl args={[0.105, 0.105, 0.06, 14]} mat={MATS.foil} p={[0, 0.23, 0]} />
    <mesh position={[0, 0.52, 0]} material={MATS.hull} castShadow>
      <coneGeometry args={[0.1, 0.18, 14]} />
    </mesh>
    {[0, 2.1, 4.2].map(a => (
      <B key={a} args={[0.03, 0.12, 0.1]} mat={A.soft}
        p={[Math.sin(a) * 0.12, 0.1, Math.cos(a) * 0.12]} r={[0, a, 0]} />
    ))}
  </group>
);

const MODELS_3D: Record<BuildingType, React.FC<ModelProps>> = {
  [BuildingType.CITY]: CityModel3D,
  // Track is rendered flat on the tile surface by Board3D, not as a 3D model.
  [BuildingType.ROAD]: () => null,
  [BuildingType.SOLAR_ARRAY]: SolarModel3D,
  [BuildingType.HABITAT]: HabitatModel3D,
  [BuildingType.ICE_EXTRACTOR]: IceExtractorModel3D,
  [BuildingType.OXYGENATOR]: OxygenatorModel3D,
  [BuildingType.GREENHOUSE]: GreenhouseModel3D,
  [BuildingType.MINING_RIG]: MiningRigModel3D,
  [BuildingType.HE3_EXTRACTOR]: He3Model3D,
  [BuildingType.LAUNCH_PAD]: LaunchPadModel3D,
};

export const BuildingMesh: React.FC<{ type: BuildingType; accent?: AccentMats }> = ({ type, accent = DEFAULT_ACCENT }) => {
  const Model = MODELS_3D[type];
  return <Model A={accent} />;
};

/** Hazard posts + holographic ghost shown while a rover builds. */
export const ConstructionMesh: React.FC<{ accent?: AccentMats }> = ({ accent = DEFAULT_ACCENT }) => (
  <group>
    {[[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]].map(([x, z], i) => (
      <B key={i} args={[0.06, 0.26, 0.06]} mat={MATS.hazard} p={[x, 0.13, z]} />
    ))}
    <B args={[0.66, 0.035, 0.035]} mat={MATS.hazard} p={[0, 0.26, -0.3]} />
    <B args={[0.66, 0.035, 0.035]} mat={MATS.hazard} p={[0, 0.26, 0.3]} />
    <B args={[0.035, 0.035, 0.66]} mat={MATS.hazard} p={[-0.3, 0.26, 0]} />
    <B args={[0.035, 0.035, 0.66]} mat={MATS.hazard} p={[0.3, 0.26, 0]} />
    <mesh position={[0, 0.16, 0]}>
      <boxGeometry args={[0.4, 0.24, 0.4]} />
      <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} transparent opacity={0.15} />
    </mesh>
    <HoloRing radius={0.34} y={0.06} mat={accent.neon} />
  </group>
);

/** Worker rover — faction-colored chassis, glass cab, glowing status light. */
export const RoverMesh: React.FC<{ working: boolean; accent?: AccentMats }> = ({ working, accent = DEFAULT_ACCENT }) => (
  <group>
    {[[-0.1, -0.09], [0.1, -0.09], [-0.1, 0.09], [0.1, 0.09]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.05, z]} rotation={[Math.PI / 2, 0, 0]} material={MATS.dark} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.045, 12]} />
      </mesh>
    ))}
    <B args={[0.3, 0.09, 0.18]} mat={accent.chassis} p={[0, 0.12, 0]} />
    <B args={[0.11, 0.09, 0.15]} mat={MATS.foil} p={[0.08, 0.21, 0]} />
    <B args={[0.11, 0.1, 0.14]} mat={MATS.glass} p={[-0.08, 0.215, 0]} />
    <mesh position={[-0.16, 0.13, -0.05]} material={accent.neon}>
      <sphereGeometry args={[0.02, 8, 8]} />
    </mesh>
    <mesh position={[-0.16, 0.13, 0.05]} material={accent.neon}>
      <sphereGeometry args={[0.02, 8, 8]} />
    </mesh>
    <Cyl args={[0.012, 0.012, 0.12, 6]} mat={MATS.metal} p={[0.12, 0.3, 0]} />
    <Beacon p={[0.12, 0.38, 0]} mat={working ? MATS.neonOrange : MATS.neonGreen} period={working ? 0.8 : 2} />
  </group>
);
