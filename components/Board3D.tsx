import React, { useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { GameState, HexData, TerrainType, BuildingType, Unit, World, VisualStyle } from '../types';
import { HEX_DIRS } from '../services/hexgrid';
import { buildTerrainMaterials, buildMoonFloorMaterial, TileMaterials } from '../services/lunarTextures';
import { BuildingMesh, ConstructionMesh, RoverMesh, getAccent, DEFAULT_ACCENT, MATS, registerEmissive } from './Models3D';
import type { SurgeKind } from '../App';

/** World-space size of one hex (center to corner). */
const HEX = 0.94;

export function hexToWorld(q: number, r: number): [number, number] {
  return [HEX * Math.sqrt(3) * (q + r / 2), HEX * 1.5 * r];
}

/** Subtle per-terrain elevation — craters sink, canyons plunge, minerals rise. */
const ELEV: Record<TerrainType, number> = {
  [TerrainType.REGOLITH]: 0,
  [TerrainType.ICE]: 0.05,
  [TerrainType.ORES]: 0.09,
  [TerrainType.SILICATES]: 0.05,
  [TerrainType.HE3]: 0.12,
  [TerrainType.CRATER]: -0.14,
  [TerrainType.CANYON]: -0.55,
  [TerrainType.OLYMPUS]: 0.1,
};

// --- Shared geometry & materials (built lazily per world) ---

const tileGeo = new THREE.CylinderGeometry(HEX * 0.985, HEX * 1.02, 0.3, 6);
const terrainMatCache = new Map<World, Record<TerrainType, TileMaterials[]>>();
const floorMatCache = new Map<World, THREE.MeshStandardMaterial>();
function terrainMatsFor(world: World) {
  if (!terrainMatCache.has(world)) terrainMatCache.set(world, buildTerrainMaterials(world));
  return terrainMatCache.get(world)!;
}
function floorMatFor(world: World) {
  if (!floorMatCache.has(world)) floorMatCache.set(world, buildMoonFloorMaterial(world));
  return floorMatCache.get(world)!;
}

const olympusMat = new THREE.MeshStandardMaterial({ color: '#96593e', roughness: 0.95, metalness: 0, flatShading: true });
const olympusCalderaMat = new THREE.MeshStandardMaterial({ color: '#3a1d12', roughness: 1, metalness: 0 });

/** Per-world scene mood. */
const WORLD_LOOK: Record<World, {
  hemi: [string, string]; sun: string; dust: string; ring: string;
}> = {
  MOON: { hemi: ['#bcd3f5', '#171a26'], sun: '#fff3dd', dust: '#9ccef5', ring: '#38bdf8' },
  MARS: { hemi: ['#f4c39a', '#241310'], sun: '#ffd9b0', dust: '#e8a97e', ring: '#fb923c' },
};

const railBedMat = new THREE.MeshStandardMaterial({ color: '#161e2c', roughness: 0.6, metalness: 0.5 });

/** Upgrade module markers — small glowing chips on the tile edge. */
const UPGRADE_MARKER_MATS: Record<string, THREE.MeshStandardMaterial> = {
  OVERCLOCK: registerEmissive(new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 2.2, toneMapped: false })),
  EFFICIENCY: registerEmissive(new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#22c55e', emissiveIntensity: 2.2, toneMapped: false })),
  AMPLIFIER: registerEmissive(new THREE.MeshStandardMaterial({ color: '#c084fc', emissive: '#a855f7', emissiveIntensity: 2.2, toneMapped: false })),
};

/** Canvas-drawn Catan number token (offline, no font fetches). */
const tokenTextureCache = new Map<string, THREE.CanvasTexture>();
function tokenTexture(value: number): THREE.CanvasTexture {
  const key = `${value}`;
  const cached = tokenTextureCache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const hot = value === 6 || value === 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = hot ? '#dc2626' : '#64748b';
  ctx.stroke();
  ctx.fillStyle = hot ? '#dc2626' : '#0f172a';
  ctx.font = `900 ${size * 0.48}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tokenTextureCache.set(key, tex);
  return tex;
}

// --- Tile ---

interface TileProps {
  hex: HexData;
  world: World;
  selected: boolean;
  frontier: boolean;
  surge: SurgeKind;
  offline: boolean;
  roadKey: string;
  /** Identity color of the owning faction (null = unclaimed). */
  ownerColor: string | null;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
}

const Tile = React.memo<TileProps>(({ hex, world, selected, frontier, surge, offline, roadKey, ownerColor, onSelect, onHover }) => {
  const accent = ownerColor ? getAccent(ownerColor) : DEFAULT_ACCENT;
  const [x, z] = hexToWorld(hex.q, hex.r);
  const elev = ELEV[hex.terrain];
  const top = 0.15;

  const surgeRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (surgeRef.current) {
      const s = 1 + 0.04 * Math.sin(clock.elapsedTime * 5);
      surgeRef.current.scale.setScalar(s);
    }
  });

  const railDirs = useMemo(
    () => (roadKey ? roadKey.split(',').map(Number) : []),
    [roadKey]
  );

  return (
    <group position={[x, elev, z]}>
      <mesh
        geometry={tileGeo}
        material={terrainMatsFor(world)[hex.terrain][hex.id % 2]}
        rotation={[0, (hex.id % 6) * (Math.PI / 3), 0]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); if (e.delta < 8) onSelect(hex.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(hex.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'default'; }}
      />

      {/* Olympus Mons — a shield volcano towering over the board */}
      {hex.terrain === TerrainType.OLYMPUS && (
        <group position={[0, top, 0]}>
          <mesh position={[0, 0.55, 0]} material={olympusMat} castShadow receiveShadow>
            <coneGeometry args={[1.5, 1.35, 7]} />
          </mesh>
          <mesh position={[0, 1.18, 0]} material={olympusCalderaMat}>
            <cylinderGeometry args={[0.3, 0.42, 0.16, 7]} />
          </mesh>
        </group>
      )}

      {/* Number token */}
      {hex.diceValue !== null && (
        <mesh position={[0.52, top + 0.005, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.19, 24]} />
          <meshBasicMaterial map={tokenTexture(hex.diceValue)} transparent />
        </mesh>
      )}

      {/* Maglev rails toward connected neighbors */}
      {hex.building === BuildingType.ROAD && (
        <group position={[0, top, 0]}>
          <mesh position={[0, 0.015, 0]} material={railBedMat} receiveShadow>
            <cylinderGeometry args={[0.22, 0.24, 0.03, 12]} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} material={accent.neon}>
            <torusGeometry args={[0.16, 0.012, 6, 24]} />
          </mesh>
          {railDirs.map(i => {
            const [dx, dz] = hexToWorld(HEX_DIRS[i].q, HEX_DIRS[i].r);
            const angle = Math.atan2(dz, dx);
            const len = 0.88;
            return (
              <group key={i} rotation={[0, -angle, 0]}>
                <mesh position={[len / 2, 0.012, 0]} material={railBedMat} receiveShadow>
                  <boxGeometry args={[len, 0.024, 0.2]} />
                </mesh>
                <mesh position={[len / 2, 0.028, -0.065]} material={accent.neon}>
                  <boxGeometry args={[len, 0.012, 0.02]} />
                </mesh>
                <mesh position={[len / 2, 0.028, 0.065]} material={accent.neon}>
                  <boxGeometry args={[len, 0.012, 0.02]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Building / construction site */}
      {hex.building && hex.building !== BuildingType.ROAD && (
        <group position={[0, top, 0]}>
          <BuildingMesh type={hex.building} accent={accent} />
        </group>
      )}
      {hex.construction && (
        <group position={[0, top, 0]}>
          <ConstructionMesh accent={accent} />
          <Html position={[0, 0.55, 0]} center style={{ pointerEvents: 'none' }}>
            <div className="board-badge board-badge-amber">
              {Math.round(((hex.construction.total - hex.construction.remaining) / hex.construction.total) * 100)}%
            </div>
          </Html>
        </group>
      )}

      {/* Upgrade module chips */}
      {(hex.upgrades ?? []).map((upgrade, i) => (
        <mesh key={upgrade} position={[-0.55 + i * 0.16, top + 0.05, 0.62]} material={UPGRADE_MARKER_MATS[upgrade]}>
          <boxGeometry args={[0.09, 0.05, 0.09]} />
        </mesh>
      ))}

      {/* Offline badge */}
      {offline && (
        <Html position={[0, 0.9, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="board-badge board-badge-red">⚠ OFFLINE</div>
        </Html>
      )}

      {/* Indicator rings */}
      {selected && (
        <mesh position={[0, top + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MATS.neonGreen}>
          <torusGeometry args={[HEX * 0.82, 0.02, 8, 48]} />
        </mesh>
      )}
      {!selected && surge === 'gold' && (
        <mesh ref={surgeRef} position={[0, top + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MATS.neonOrange}>
          <torusGeometry args={[HEX * 0.8, 0.025, 8, 48]} />
        </mesh>
      )}
      {!selected && surge === 'ring' && (
        <mesh position={[0, top + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[HEX * 0.78, 0.012, 6, 40]} />
          <meshBasicMaterial color="#e2e8f0" transparent opacity={0.4} />
        </mesh>
      )}
      {!selected && surge === 'none' && frontier && (
        <mesh position={[0, top + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[HEX * 0.8, 0.01, 6, 40]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  );
});
Tile.displayName = 'Tile';

// --- Rover unit with smooth motion ---

const RoverUnit: React.FC<{ unit: Unit; color: string }> = ({ unit, color }) => {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => {
    const [x, z] = hexToWorld(unit.q, unit.r);
    // Nudge idle rovers apart so they don't stack at the hub.
    const jx = unit.state === 'idle' ? Math.cos(unit.id * 2.4) * 0.34 : 0;
    const jz = unit.state === 'idle' ? Math.sin(unit.id * 2.4) * 0.34 : 0;
    return new THREE.Vector3(x + jx, 0.15, z + jz);
  }, [unit.q, unit.r, unit.state, unit.id]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    g.position.lerp(target, Math.min(1, delta * 2.2));
    const dir = target.clone().sub(g.position);
    if (dir.lengthSq() > 0.002) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(-dir.z, dir.x) + Math.PI, 0.15);
    }
  });

  return (
    <group ref={ref} position={target.toArray()}>
      <RoverMesh working={unit.state === 'constructing'} accent={getAccent(color)} />
    </group>
  );
};

// --- Board ---

export interface YieldPopup {
  id: number;
  q: number;
  r: number;
  text: string;
  color: string;
}

interface Board3DProps {
  gameState: GameState;
  style: VisualStyle;
  selectedHexId: number | null;
  frontierIds: Set<number>;
  activeIds: Set<number>;
  roadKeys: Map<number, string>;
  surgeFor: (hexId: number) => SurgeKind;
  popups: YieldPopup[];
  autoplay: boolean;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
}

const Board3D: React.FC<Board3DProps> = ({
  gameState, style, selectedHexId, frontierIds, activeIds, roadKeys, surgeFor, popups, autoplay, onSelect, onHover,
}) => {
  const handleMiss = useCallback(() => onSelect(-1), [onSelect]);
  const radius = gameState.boardRadius;
  const world = gameState.world ?? 'MOON';
  const look = WORLD_LOOK[world];
  const floorRadius = (radius + 2.2) * HEX * Math.sqrt(3);
  const camScale = 1 + (radius - 4) * 0.28;

  return (
    <Canvas
      key={`board-${world}-${radius}`}
      shadows
      dpr={[1.5, 2.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 11.5 * camScale, 13 * camScale], fov: 42 }}
      onPointerMissed={handleMiss}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Lighting: warm key sun + per-world sky bounce */}
      <hemisphereLight args={[look.hemi[0], look.hemi[1], world === 'MARS' ? 0.65 : 0.55]} />
      <directionalLight
        castShadow
        position={[14, 22, 9]}
        intensity={2.4}
        color={look.sun}
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-12 * camScale}
        shadow-camera-right={12 * camScale}
        shadow-camera-top={12 * camScale}
        shadow-camera-bottom={-12 * camScale}
        shadow-bias={-0.0004}
      />
      <ambientLight intensity={0.12} />

      {/* Photoreal planet surface catches shadows and grounds the board */}
      <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMatFor(world)} receiveShadow>
        <circleGeometry args={[floorRadius, 64]} />
      </mesh>
      <mesh position={[0, -0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[floorRadius - 0.06, floorRadius, 64]} />
        <meshBasicMaterial color={look.ring} transparent opacity={0.25} />
      </mesh>

      {/* Ambient dust motes */}
      <Sparkles count={world === 'MARS' ? 140 : 90} scale={[16 * camScale, 5, 16 * camScale]} position={[0, 2, 0]} size={1.6} speed={world === 'MARS' ? 0.45 : 0.25} opacity={0.4} color={look.dust} />

      {gameState.board.map(hex => (
        <Tile
          key={hex.id}
          hex={hex}
          world={world}
          selected={hex.id === selectedHexId}
          frontier={frontierIds.has(hex.id)}
          surge={surgeFor(hex.id)}
          offline={!!hex.building && !activeIds.has(hex.id)}
          roadKey={roadKeys.get(hex.id) ?? ''}
          ownerColor={hex.owner !== null ? gameState.factions[hex.owner]?.color ?? null : null}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}

      {gameState.factions.flatMap(faction =>
        faction.units.map(unit => (
          <RoverUnit key={unit.id} unit={unit} color={faction.color} />
        ))
      )}

      {/* Floating yield numbers */}
      {popups.map(p => {
        const [x, z] = hexToWorld(p.q, p.r);
        return (
          <Html key={p.id} position={[x, 1.1, z]} center style={{ pointerEvents: 'none' }}>
            <div className="yield-popup-3d" style={{ color: p.color }}>{p.text}</div>
          </Html>
        );
      })}

      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={1.1} intensity={style === 'NASA' ? 0.25 : 0.85} radius={0.7} />
      </EffectComposer>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={6}
        maxDistance={26 * camScale}
        minPolarAngle={0.35}
        maxPolarAngle={1.32}
        autoRotate={autoplay}
        autoRotateSpeed={0.6}
        dampingFactor={0.08}
      />
    </Canvas>
  );
};

export default Board3D;
