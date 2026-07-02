import React from 'react';
import { BuildingType } from '../types';

/**
 * Tiny CSS-3D construction kit. Everything is composed of axis-aligned
 * boxes, flat discs, and tilted panels rendered with preserve-3d
 * transforms — no WebGL. Coordinates: x/y on the ground plane, z up.
 */

const face = (extra: React.CSSProperties): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  backfaceVisibility: 'visible',
  ...extra,
});

interface BoxProps {
  w: number; d: number; h: number;
  x?: number; y?: number; z?: number;
  color: string;
  opacity?: number;
  glow?: string;
}

/** An extruded box: 4 walls + a lid, shaded per side. */
export const Box: React.FC<BoxProps> = ({ w, d, h, x = 0, y = 0, z = 0, color, opacity = 1, glow }) => {
  const walls = [
    { angle: 0, tx: 0, ty: d / 2, fw: w, bright: 0.85 },
    { angle: 90, tx: w / 2, ty: 0, fw: d, bright: 0.7 },
    { angle: 180, tx: 0, ty: -d / 2, fw: w, bright: 0.5 },
    { angle: 270, tx: -w / 2, ty: 0, fw: d, bright: 0.62 },
  ];
  return (
    <>
      {walls.map((wall, i) => (
        <div
          key={i}
          style={face({
            width: wall.fw,
            height: h,
            backgroundColor: color,
            opacity,
            filter: `brightness(${wall.bright})`,
            transform: `translate(-50%, -50%) translate3d(${x + wall.tx}px, ${y + wall.ty}px, ${z + h / 2}px) rotateZ(${wall.angle}deg) rotateX(90deg)`,
          })}
        />
      ))}
      <div
        style={face({
          width: w,
          height: d,
          backgroundColor: color,
          opacity,
          filter: 'brightness(1.15)',
          boxShadow: glow,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z + h}px)`,
        })}
      />
    </>
  );
};

interface DiscProps {
  r: number;
  x?: number; y?: number; z?: number;
  color: string;
  opacity?: number;
  glow?: string;
  bright?: number;
}

/** A flat disc parallel to the ground. */
export const Disc: React.FC<DiscProps> = ({ r, x = 0, y = 0, z = 0, color, opacity = 1, glow, bright = 1 }) => (
  <div
    style={face({
      width: r * 2,
      height: r * 2,
      borderRadius: '50%',
      backgroundColor: color,
      opacity,
      filter: `brightness(${bright})`,
      boxShadow: glow,
      transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px)`,
    })}
  />
);

/** Ground shadow under a structure. */
const Shadow: React.FC<{ r: number }> = ({ r }) => (
  <Disc r={r} z={0.5} color="rgba(0,0,0,0.45)" />
);

/** A tilted solar panel. */
const Panel: React.FC<{ x?: number; y?: number; z?: number; w: number; h: number }> = ({ x = 0, y = 0, z = 0, w, h }) => (
  <div
    style={face({
      width: w,
      height: h,
      background: 'linear-gradient(160deg, #1d4ed8 0%, #3b82f6 45%, #93c5fd 50%, #1e40af 55%, #172554 100%)',
      border: '2px solid #cbd5e1',
      transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateX(38deg)`,
      boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
    })}
  />
);

/** A hemispheric dome built from shrinking stacked discs. */
const Dome: React.FC<{ r: number; h: number; x?: number; y?: number; color: string; tint?: string }> = ({ r, h, x = 0, y = 0, color, tint }) => {
  const layers = 6;
  return (
    <>
      {Array.from({ length: layers }).map((_, i) => {
        const t = (i + 1) / layers;
        const lr = r * Math.sqrt(1 - t * t * 0.92);
        return (
          <Disc
            key={i}
            r={Math.max(lr, r * 0.16)}
            x={x} y={y} z={2 + t * h}
            color={color}
            bright={0.75 + t * 0.5}
            glow={i === layers - 1 && tint ? `0 0 12px ${tint}` : undefined}
          />
        );
      })}
    </>
  );
};

const CityModel: React.FC = () => (
  <>
    <Shadow r={34} />
    <Box w={48} d={48} h={10} color="#334155" />
    <Box w={36} d={36} h={13} z={10} color="#475569" />
    <Box w={24} d={24} h={15} z={23} color="#64748b" />
    <Box w={4} d={4} h={16} z={38} color="#94a3b8" />
    <Disc r={5} z={55} color="#38bdf8" glow="0 0 14px #38bdf8, 0 0 30px rgba(56,189,248,0.6)" />
    <Dome r={13} h={11} x={-24} y={20} color="#cbd5e1" tint="rgba(148,163,184,0.7)" />
    <Dome r={13} h={11} x={24} y={20} color="#cbd5e1" tint="rgba(148,163,184,0.7)" />
  </>
);

const SolarModel: React.FC = () => (
  <>
    <Shadow r={26} />
    <Box w={8} d={8} h={8} x={-16} color="#475569" />
    <Box w={8} d={8} h={8} x={16} color="#475569" />
    <Panel x={-16} w={26} h={20} z={13} />
    <Panel x={16} w={26} h={20} z={13} />
  </>
);

const HabitatModel: React.FC = () => (
  <>
    <Shadow r={28} />
    <Box w={14} d={10} h={7} y={24} color="#64748b" />
    <Dome r={26} h={20} color="#e2e8f0" tint="rgba(125, 211, 252, 0.8)" />
    <Disc r={4} z={24} color="#fbbf24" glow="0 0 8px rgba(251,191,36,0.9)" />
  </>
);

const IceExtractorModel: React.FC = () => (
  <>
    <Shadow r={22} />
    <Box w={22} d={22} h={9} color="#0c4a6e" />
    <Box w={7} d={7} h={26} z={9} color="#38bdf8" glow="0 0 10px rgba(56,189,248,0.8)" />
    <Disc r={9} z={37} color="#bae6fd" glow="0 0 12px rgba(186,230,253,0.9)" />
  </>
);

const OxygenatorModel: React.FC = () => (
  <>
    <Shadow r={22} />
    <Box w={26} d={16} h={9} color="#134e4a" />
    <Box w={8} d={8} h={19} x={-7} z={9} color="#2dd4bf" />
    <Box w={8} d={8} h={14} x={7} z={9} color="#5eead4" />
    <Disc r={4} z={30} x={-7} color="#ccfbf1" glow="0 0 10px rgba(94,234,212,0.9)" />
  </>
);

const GreenhouseModel: React.FC = () => (
  <>
    <Shadow r={26} />
    <Box w={42} d={22} h={8} color="#14532d" />
    <Box w={38} d={16} h={9} z={8} color="#22c55e" opacity={0.75} glow="0 0 14px rgba(74,222,128,0.6)" />
    <Box w={4} d={22} h={9} z={8} color="#dcfce7" opacity={0.9} />
  </>
);

const MiningRigModel: React.FC = () => (
  <>
    <Shadow r={24} />
    <Box w={22} d={22} h={8} color="#451a03" />
    <Box w={11} d={11} h={22} z={8} color="#92400e" />
    <Box w={26} d={6} h={4} z={30} color="#d97706" />
    <Disc r={6} z={12} x={18} color="#f97316" opacity={0.7} glow="0 0 12px rgba(249,115,22,0.8)" />
  </>
);

const He3Model: React.FC = () => (
  <>
    <Shadow r={22} />
    <Box w={24} d={24} h={8} color="#2e1065" />
    <Box w={13} d={13} h={17} z={8} color="#7c3aed" />
    <Disc r={8} z={28} color="#a78bfa" glow="0 0 14px rgba(167,139,250,0.9), 0 0 28px rgba(139,92,246,0.5)" />
  </>
);

const LaunchPadModel: React.FC = () => (
  <>
    <Shadow r={30} />
    <Disc r={28} z={2} color="#334155" bright={1.05} />
    <Disc r={20} z={2.6} color="#1e293b" />
    <Box w={5} d={5} h={12} x={-22} y={-14} color="#dc2626" />
    <Box w={5} d={5} h={12} x={22} y={-14} color="#dc2626" />
    <Box w={9} d={9} h={24} z={2.6} color="#e2e8f0" />
    <Disc r={4} z={30} color="#f87171" glow="0 0 8px rgba(248,113,113,0.9)" />
    <Box w={3} d={3} h={7} x={8} y={8} z={2.6} color="#94a3b8" />
  </>
);

const MODELS: Record<BuildingType, React.FC> = {
  [BuildingType.CITY]: CityModel,
  [BuildingType.SOLAR_ARRAY]: SolarModel,
  [BuildingType.HABITAT]: HabitatModel,
  [BuildingType.ICE_EXTRACTOR]: IceExtractorModel,
  [BuildingType.OXYGENATOR]: OxygenatorModel,
  [BuildingType.GREENHOUSE]: GreenhouseModel,
  [BuildingType.MINING_RIG]: MiningRigModel,
  [BuildingType.HE3_EXTRACTOR]: He3Model,
  [BuildingType.LAUNCH_PAD]: LaunchPadModel,
};

export const BuildingModel: React.FC<{ type: BuildingType }> = ({ type }) => {
  const Model = MODELS[type];
  return <Model />;
};

/** Scaffolding shown while a rover erects a building. */
export const ConstructionSite: React.FC = () => (
  <>
    <Shadow r={24} />
    {[[-18, -18], [18, -18], [18, 18], [-18, 18]].map(([px, py], i) => (
      <Box key={i} w={4} d={4} h={16} x={px} y={py} color="#f59e0b" />
    ))}
    <Box w={40} d={4} h={3} y={-18} z={16} color="#fbbf24" />
    <Box w={40} d={4} h={3} y={18} z={16} color="#fbbf24" />
    <Box w={4} d={40} h={3} x={-18} z={16} color="#fbbf24" />
    <Box w={4} d={40} h={3} x={18} z={16} color="#fbbf24" />
  </>
);

/** A worker rover unit. */
export const WorkerModel: React.FC<{ working?: boolean }> = ({ working }) => (
  <>
    <Shadow r={12} />
    <Box w={18} d={12} h={6} z={2} color="#ca8a04" />
    <Box w={8} d={9} h={6} x={-4} z={8} color="#facc15" />
    <Box w={2.5} d={2.5} h={7} x={7} z={8} color="#94a3b8" />
    <Disc
      r={2.5} x={7} z={16}
      color={working ? '#fb923c' : '#4ade80'}
      glow={working ? '0 0 8px rgba(251,146,60,0.9)' : '0 0 8px rgba(74,222,128,0.9)'}
    />
  </>
);
