import React from 'react';
import { BuildingType } from '../types';

/**
 * CSS-3D construction kit, NASA x cyberpunk edition. Everything is
 * composed of boxes, n-sided cylinders, discs, domes, and emissive
 * neon parts rendered with preserve-3d transforms — no WebGL.
 *
 * Style guide: white hull plating with visible panel lines, gold
 * Kapton foil (MLI insulation), matte trusses and hazard chevrons on
 * the NASA side; cyan/magenta emissive strips, holo rings, and
 * blinking beacons on the cyberpunk side.
 */

// --- Materials (layered CSS gradients) ---

const FINISHES = {
  hull: 'repeating-linear-gradient(90deg, rgba(2,6,23,0.16) 0 1px, transparent 1px 8px), linear-gradient(180deg, #f8fafc 0%, #cbd5e1 60%, #94a3b8 100%)',
  foil: 'repeating-linear-gradient(100deg, #92400e 0px, #d97706 2px, #fbbf24 3px, #b45309 5px, #a16207 7px)',
  metal: 'repeating-linear-gradient(0deg, #475569 0 1px, #64748b 1px 3px), linear-gradient(180deg, #64748b, #334155)',
  dark: 'linear-gradient(180deg, #1e293b, #0f172a)',
  glass: 'linear-gradient(160deg, rgba(186,230,253,0.85) 0%, rgba(56,189,248,0.5) 40%, rgba(30,58,138,0.6) 100%)',
  chevron: 'repeating-linear-gradient(45deg, #facc15 0 5px, #0f172a 5px 10px)',
  solarcell: 'repeating-linear-gradient(90deg, rgba(15,23,42,0.55) 0 1px, transparent 1px 7px), repeating-linear-gradient(0deg, rgba(15,23,42,0.55) 0 1px, transparent 1px 7px), linear-gradient(160deg, #1d4ed8 0%, #3b82f6 45%, #93c5fd 50%, #1e40af 55%, #172554 100%)',
  geodesic: 'repeating-conic-gradient(from 10deg, rgba(148,163,184,0.5) 0 1.5deg, transparent 1.5deg 30deg), linear-gradient(180deg, #f8fafc, #cbd5e1)',
} as const;

type Finish = keyof typeof FINISHES;

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
  finish?: Finish;
  /** Emissive glow color — disables shading, adds bloom. */
  emissive?: string;
  opacity?: number;
  className?: string;
}

/** An extruded box: 4 walls + a lid, shaded per side. */
export const Box: React.FC<BoxProps> = ({ w, d, h, x = 0, y = 0, z = 0, color, finish, emissive, opacity = 1, className }) => {
  const walls = [
    { angle: 0, tx: 0, ty: d / 2, fw: w, bright: 0.85 },
    { angle: 90, tx: w / 2, ty: 0, fw: d, bright: 0.68 },
    { angle: 180, tx: 0, ty: -d / 2, fw: w, bright: 0.5 },
    { angle: 270, tx: -w / 2, ty: 0, fw: d, bright: 0.6 },
  ];
  const background = finish ? FINISHES[finish] : undefined;
  const glow = emissive ? `0 0 8px ${emissive}, 0 0 18px ${emissive}` : undefined;
  return (
    <>
      {walls.map((wall, i) => (
        <div
          key={i}
          className={className}
          style={face({
            width: wall.fw,
            height: h,
            backgroundColor: color,
            backgroundImage: background,
            opacity,
            filter: emissive ? 'brightness(1.1)' : `brightness(${wall.bright})`,
            boxShadow: glow,
            transform: `translate(-50%, -50%) translate3d(${x + wall.tx}px, ${y + wall.ty}px, ${z + h / 2}px) rotateZ(${wall.angle}deg) rotateX(90deg)`,
          })}
        />
      ))}
      <div
        className={className}
        style={face({
          width: w,
          height: d,
          backgroundColor: color,
          backgroundImage: background,
          opacity,
          filter: emissive ? 'brightness(1.2)' : 'brightness(1.12)',
          boxShadow: glow,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z + h}px)`,
        })}
      />
    </>
  );
};

interface CylProps {
  r: number; h: number;
  x?: number; y?: number; z?: number;
  color: string;
  finish?: Finish;
  emissive?: string;
  sides?: number;
  opacity?: number;
}

/** An n-sided cylinder: smooth-shaded walls + a lid. */
export const Cyl: React.FC<CylProps> = ({ r, h, x = 0, y = 0, z = 0, color, finish, emissive, sides = 8, opacity = 1 }) => {
  const sideW = 2 * r * Math.tan(Math.PI / sides) + 0.6;
  const background = finish ? FINISHES[finish] : undefined;
  const glow = emissive ? `0 0 8px ${emissive}` : undefined;
  return (
    <>
      {Array.from({ length: sides }).map((_, i) => {
        const angle = (i * 360) / sides;
        const rad = (angle * Math.PI) / 180;
        const bright = emissive ? 1.05 : 0.55 + 0.35 * Math.cos(rad - 0.7);
        return (
          <div
            key={i}
            style={face({
              width: sideW,
              height: h,
              backgroundColor: color,
              backgroundImage: background,
              opacity,
              filter: `brightness(${bright})`,
              boxShadow: glow,
              transform: `translate(-50%, -50%) translate3d(${x + Math.sin(rad) * r}px, ${y - Math.cos(rad) * r}px, ${z + h / 2}px) rotateZ(${angle}deg) rotateX(90deg)`,
            })}
          />
        );
      })}
      <div
        style={face({
          width: r * 2.1,
          height: r * 2.1,
          borderRadius: '50%',
          backgroundColor: color,
          backgroundImage: background,
          opacity,
          filter: 'brightness(1.12)',
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
  background?: string;
  opacity?: number;
  glow?: string;
  bright?: number;
  className?: string;
}

/** A flat disc parallel to the ground. */
export const Disc: React.FC<DiscProps> = ({ r, x = 0, y = 0, z = 0, color, background, opacity = 1, glow, bright = 1, className }) => (
  <div
    className={className}
    style={face({
      width: r * 2,
      height: r * 2,
      borderRadius: '50%',
      backgroundColor: color,
      backgroundImage: background,
      opacity,
      filter: `brightness(${bright})`,
      boxShadow: glow,
      transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px)`,
    })}
  />
);

/** Ground shadow under a structure. */
const Shadow: React.FC<{ r: number }> = ({ r }) => (
  <Disc r={r} z={0.4} color="transparent" background="radial-gradient(circle, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 55%, transparent 75%)" />
);

/** Spinning holographic ring (flat, dashed, glowing). Positioned via CSS
 * vars because the spin animation owns the transform property. */
const HoloRing: React.FC<{ r: number; z: number; color: string; x?: number; y?: number; reverse?: boolean }> = ({ r, z, color, x = 0, y = 0, reverse }) => (
  <div
    className={reverse ? 'holo-spin-rev' : 'holo-spin'}
    style={face({
      width: r * 2,
      height: r * 2,
      borderRadius: '50%',
      border: `2px dashed ${color}`,
      boxShadow: `0 0 10px ${color}, inset 0 0 10px ${color}`,
      opacity: 0.75,
      ['--hx' as string]: `${x}px`,
      ['--hy' as string]: `${y}px`,
      ['--hz' as string]: `${z}px`,
    })}
  />
);

/** Blinking aviation/status beacon. */
const Beacon: React.FC<{ x?: number; y?: number; z: number; color: string; slow?: boolean }> = ({ x = 0, y = 0, z, color, slow }) => (
  <Disc
    r={2.6} x={x} y={y} z={z}
    color={color}
    glow={`0 0 6px ${color}, 0 0 16px ${color}`}
    className={slow ? 'beacon-blink-slow' : 'beacon-blink'}
  />
);

/** A hemispheric dome built from shrinking stacked discs. */
const Dome: React.FC<{ r: number; h: number; x?: number; y?: number; color: string; background?: string; tint?: string; opacity?: number }> =
  ({ r, h, x = 0, y = 0, color, background, tint, opacity = 1 }) => {
    const layers = 7;
    return (
      <>
        {Array.from({ length: layers }).map((_, i) => {
          const t = (i + 1) / layers;
          const lr = r * Math.sqrt(1 - t * t * 0.94);
          return (
            <Disc
              key={i}
              r={Math.max(lr, r * 0.14)}
              x={x} y={y} z={1.5 + t * h}
              color={color}
              background={background}
              opacity={opacity}
              bright={0.72 + t * 0.55}
              glow={i === layers - 1 && tint ? `0 0 14px ${tint}` : undefined}
            />
          );
        })}
      </>
    );
  };

/** A tilted solar panel with visible cell grid and neon under-edge. */
const SolarPanel: React.FC<{ x?: number; y?: number; z?: number; w: number; h: number }> = ({ x = 0, y = 0, z = 0, w, h }) => (
  <>
    <div
      style={face({
        width: w,
        height: h,
        backgroundImage: FINISHES.solarcell,
        border: '1.5px solid #e2e8f0',
        transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateX(38deg)`,
        boxShadow: '0 0 12px rgba(59, 130, 246, 0.55)',
      })}
    />
    <div
      style={face({
        width: w,
        height: 2.5,
        background: '#22d3ee',
        transform: `translate(-50%, -50%) translate3d(${x}px, ${y + h * 0.38}px, ${z - h * 0.3}px) rotateX(38deg)`,
        boxShadow: '0 0 8px #22d3ee, 0 0 16px rgba(34,211,238,0.7)',
      })}
    />
  </>
);

/** Four-post truss segment with cross-bracing look. */
const Truss: React.FC<{ s: number; h: number; z?: number; x?: number; y?: number }> = ({ s, h, z = 0, x = 0, y = 0 }) => (
  <>
    {[[-s, -s], [s, -s], [s, s], [-s, s]].map(([px, py], i) => (
      <Box key={i} w={2.5} d={2.5} h={h} x={x + px} y={y + py} z={z} color="#64748b" finish="metal" />
    ))}
    <Box w={s * 2 + 2.5} d={2} h={2} x={x} y={y - s} z={z + h - 2} color="#94a3b8" />
    <Box w={s * 2 + 2.5} d={2} h={2} x={x} y={y + s} z={z + h - 2} color="#94a3b8" />
    <Box w={2} d={s * 2 + 2.5} h={2} x={x - s} y={y} z={z + h - 2} color="#94a3b8" />
    <Box w={2} d={s * 2 + 2.5} h={2} x={x + s} y={y} z={z + h - 2} color="#94a3b8" />
  </>
);

// --- Building models ---

const CityModel: React.FC = () => (
  <>
    <Shadow r={40} />
    {/* Landing apron with painted ring + holo perimeter */}
    <Disc r={42} z={0.8} color="#111827" background="radial-gradient(circle, transparent 58%, rgba(248,250,252,0.5) 60% 62%, transparent 64%), radial-gradient(circle, #1f2937 0%, #0b1220 80%)" />
    <HoloRing r={45} z={2} color="rgba(34,211,238,0.8)" />
    {/* Gold-foil service level */}
    <Box w={46} d={46} h={9} color="#b45309" finish="foil" />
    {/* Hull tiers with neon window bands */}
    <Box w={35} d={35} h={13} z={9} color="#cbd5e1" finish="hull" />
    <Box w={35.8} d={35.8} h={2.2} z={17} color="#22d3ee" emissive="rgba(34,211,238,0.9)" className="neon-flicker" />
    <Box w={24} d={24} h={15} z={22} color="#e2e8f0" finish="hull" />
    <Box w={24.8} d={24.8} h={2.2} z={30} color="#e879f9" emissive="rgba(232,121,249,0.9)" />
    {/* Command crown + comms */}
    <Cyl r={8} h={7} z={37} color="#94a3b8" finish="metal" />
    <Box w={2.5} d={2.5} h={17} z={44} color="#e2e8f0" />
    <Box w={9} d={1.5} h={1.5} z={56} color="#e2e8f0" />
    <Beacon z={62} color="#f87171" />
    <HoloRing r={16} z={52} color="rgba(34,211,238,0.9)" reverse />
    {/* Glass habitat wings */}
    <Dome r={12} h={10} x={-23} y={20} color="#bae6fd" background={FINISHES.glass} tint="rgba(56,189,248,0.8)" opacity={0.92} />
    <Dome r={12} h={10} x={23} y={20} color="#bae6fd" background={FINISHES.glass} tint="rgba(56,189,248,0.8)" opacity={0.92} />
    <Box w={10} d={8} h={5} y={-22} color="#0f172a" finish="chevron" />
  </>
);

const SolarModel: React.FC = () => (
  <>
    <Shadow r={28} />
    <Box w={9} d={9} h={7} x={-15} color="#b45309" finish="foil" />
    <Box w={9} d={9} h={7} x={15} color="#b45309" finish="foil" />
    <Box w={34} d={2.5} h={2.5} z={7} color="#94a3b8" finish="metal" />
    <SolarPanel x={-15} w={26} h={22} z={14} />
    <SolarPanel x={15} w={26} h={22} z={14} />
    <Box w={2} d={2} h={10} y={-16} color="#e2e8f0" />
    <Beacon y={-16} z={11} color="#4ade80" slow />
  </>
);

const HabitatModel: React.FC = () => (
  <>
    <Shadow r={30} />
    {/* Geodesic pressure dome with porthole light-ring */}
    <Dome r={26} h={19} color="#f1f5f9" background={FINISHES.geodesic} tint="rgba(232,121,249,0.55)" />
    <Disc
      r={22} z={6.5} color="transparent"
      background="radial-gradient(circle, transparent 72%, rgba(34,211,238,0.9) 76% 82%, transparent 86%)"
      glow="0 0 10px rgba(34,211,238,0.5)"
      className="neon-flicker"
    />
    {/* Airlock tunnel with hazard chevrons */}
    <Box w={13} d={12} h={7} y={25} color="#cbd5e1" finish="hull" />
    <Box w={13.6} d={2.5} h={7.4} y={31} color="#0f172a" finish="chevron" />
    <Beacon x={0} y={0} z={24} color="#e879f9" slow />
  </>
);

const IceExtractorModel: React.FC = () => (
  <>
    <Shadow r={26} />
    <Box w={24} d={24} h={7} color="#0c4a6e" finish="dark" />
    <Box w={24.6} d={24.6} h={1.8} z={7} color="#22d3ee" emissive="rgba(34,211,238,0.8)" />
    <Truss s={9} h={30} z={8.8} />
    {/* Pulsing cryo-drill core */}
    <Box w={5} d={5} h={28} z={8.8} color="#7dd3fc" emissive="rgba(125,211,252,0.9)" className="drill-pulse" />
    <Cyl r={7} h={4} z={38.8} color="#e2e8f0" finish="hull" sides={6} />
    <Disc r={10} z={44} color="transparent" background="radial-gradient(circle, rgba(186,230,253,0.85), transparent 70%)" glow="0 0 16px rgba(186,230,253,0.8)" className="drill-pulse" />
    <Box w={26} d={3} h={3} y={14} z={0.5} color="#38bdf8" emissive="rgba(56,189,248,0.6)" />
  </>
);

const OxygenatorModel: React.FC = () => (
  <>
    <Shadow r={26} />
    <Box w={30} d={18} h={6} color="#134e4a" finish="dark" />
    {/* Twin electrolysis columns */}
    <Cyl r={6.5} h={20} x={-8} z={6} color="#f1f5f9" finish="hull" />
    <Cyl r={6.5} h={15} x={8} z={6} color="#f1f5f9" finish="hull" />
    <Disc r={7} x={-8} z={16} color="transparent" background="radial-gradient(circle, transparent 55%, rgba(45,212,191,0.9) 60% 72%, transparent 78%)" glow="0 0 8px rgba(45,212,191,0.6)" />
    <Disc r={7} x={8} z={12} color="transparent" background="radial-gradient(circle, transparent 55%, rgba(45,212,191,0.9) 60% 72%, transparent 78%)" glow="0 0 8px rgba(45,212,191,0.6)" />
    {/* Gold manifold piping */}
    <Box w={16} d={3} h={3} z={9} color="#b45309" finish="foil" />
    <Beacon x={-8} z={28.5} color="#2dd4bf" />
  </>
);

const GreenhouseModel: React.FC = () => (
  <>
    <Shadow r={28} />
    <Box w={42} d={22} h={6} color="#f1f5f9" finish="hull" />
    {/* Glass barrel with magenta grow-lights inside */}
    <Box w={38} d={17} h={8} z={6} color="#7dd3fc" finish="glass" opacity={0.6} />
    <Box w={32} d={12} h={6} z={14} color="#7dd3fc" finish="glass" opacity={0.55} />
    <Box w={34} d={13} h={7} z={6.5} color="#f0abfc" emissive="rgba(240,171,252,0.75)" opacity={0.5} className="grow-pulse" />
    {/* Frame ribs */}
    <Box w={2.5} d={22.6} h={9} z={6} x={-12} color="#e2e8f0" />
    <Box w={2.5} d={22.6} h={9} z={6} x={0} color="#e2e8f0" />
    <Box w={2.5} d={22.6} h={9} z={6} x={12} color="#e2e8f0" />
    <Beacon y={-12} z={10} color="#a3e635" slow />
  </>
);

const MiningRigModel: React.FC = () => (
  <>
    <Shadow r={28} />
    <Box w={26} d={26} h={6} color="#292524" finish="dark" />
    <Box w={26.6} d={26.6} h={2.5} z={6} color="#0f172a" finish="chevron" />
    <Truss s={8} h={26} z={8.5} />
    {/* Ore hopper + molten glow */}
    <Box w={12} d={12} h={9} z={34.5} color="#78350f" finish="foil" />
    <Box w={28} d={5} h={4} x={4} z={28} color="#b45309" finish="metal" />
    <Box w={4} d={4} h={12} x={16} z={16} color="#f97316" emissive="rgba(249,115,22,0.85)" className="drill-pulse" />
    <Disc r={7} x={16} z={4} color="transparent" background="radial-gradient(circle, rgba(249,115,22,0.8), transparent 70%)" glow="0 0 14px rgba(249,115,22,0.7)" />
    <Beacon z={46} color="#fbbf24" />
  </>
);

const He3Model: React.FC = () => (
  <>
    <Shadow r={26} />
    <Box w={26} d={26} h={6} color="#1e1b4b" finish="dark" />
    {/* Containment posts */}
    {[[-11, -11], [11, -11], [11, 11], [-11, 11]].map(([px, py], i) => (
      <Box key={i} w={3} d={3} h={14} x={px} y={py} z={6} color="#94a3b8" finish="metal" />
    ))}
    {/* Fusion-feed reactor core */}
    <Cyl r={8} h={16} z={6} color="#4c1d95" finish="dark" />
    <Box w={4.5} d={4.5} h={24} z={6} color="#a78bfa" emissive="rgba(167,139,250,0.95)" className="drill-pulse" />
    <HoloRing r={14} z={24} color="rgba(167,139,250,0.9)" />
    <HoloRing r={10} z={31} color="rgba(232,121,249,0.8)" reverse />
    <Disc r={6} z={31} color="#e9d5ff" glow="0 0 16px rgba(167,139,250,0.9), 0 0 34px rgba(139,92,246,0.6)" />
  </>
);

const LaunchPadModel: React.FC = () => (
  <>
    <Shadow r={34} />
    {/* Marked pad: painted ring + crosshairs + neon rim */}
    <Disc
      r={30} z={1.6} color="#1f2937"
      background="linear-gradient(0deg, transparent 47%, rgba(248,250,252,0.55) 48% 52%, transparent 53%), linear-gradient(90deg, transparent 47%, rgba(248,250,252,0.55) 48% 52%, transparent 53%), radial-gradient(circle, transparent 62%, rgba(248,250,252,0.6) 64% 67%, transparent 69%), radial-gradient(circle, #374151 0%, #111827 85%)"
    />
    <HoloRing r={32} z={2.4} color="rgba(34,211,238,0.7)" />
    {/* Gantry tower */}
    <Truss s={4} h={34} x={-20} y={-14} z={1.6} />
    <Box w={14} d={2.5} h={2.5} x={-12} y={-14} z={32} color="#94a3b8" finish="metal" />
    <Beacon x={-20} y={-14} z={38} color="#f87171" />
    {/* Rocket: white hull, foil interstage, glass crew dome */}
    <Cyl r={5.5} h={22} z={1.6} color="#f8fafc" finish="hull" />
    <Cyl r={5.8} h={3.5} z={12} color="#b45309" finish="foil" />
    <Dome r={5} h={6} color="#bae6fd" background={FINISHES.glass} tint="rgba(56,189,248,0.7)" x={0} y={0} opacity={0.95} />
    <Disc r={5} z={30} color="#e2e8f0" bright={1.2} />
    {/* Fueling line */}
    <Box w={3} d={14} h={2.5} x={10} y={10} z={1.6} color="#22d3ee" emissive="rgba(34,211,238,0.55)" />
  </>
);

const MODELS: Record<BuildingType, React.FC> = {
  [BuildingType.CITY]: CityModel,
  // Track is rendered flat on the tile surface by Hexagon, not as a 3D model.
  [BuildingType.ROAD]: () => null,
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

/** Holographic blueprint + scaffolding shown while a rover builds. */
export const ConstructionSite: React.FC = () => (
  <>
    <Shadow r={26} />
    {[[-18, -18], [18, -18], [18, 18], [-18, 18]].map(([px, py], i) => (
      <Box key={i} w={3.5} d={3.5} h={15} x={px} y={py} color="#0f172a" finish="chevron" />
    ))}
    <Box w={39.5} d={3} h={2.5} y={-18} z={15} color="#fbbf24" emissive="rgba(251,191,36,0.4)" />
    <Box w={39.5} d={3} h={2.5} y={18} z={15} color="#fbbf24" emissive="rgba(251,191,36,0.4)" />
    <Box w={3} d={39.5} h={2.5} x={-18} z={15} color="#fbbf24" emissive="rgba(251,191,36,0.4)" />
    <Box w={3} d={39.5} h={2.5} x={18} z={15} color="#fbbf24" emissive="rgba(251,191,36,0.4)" />
    {/* Holographic building ghost */}
    <Box w={22} d={22} h={12} z={2} color="#22d3ee" opacity={0.16} emissive="rgba(34,211,238,0.25)" />
    <HoloRing r={20} z={3} color="rgba(34,211,238,0.8)" />
  </>
);

/** A worker rover unit — white/gold chassis, cyan headlights. */
export const WorkerModel: React.FC<{ working?: boolean }> = ({ working }) => (
  <>
    <Shadow r={13} />
    {/* Wheels hint + chassis */}
    <Box w={16} d={3} h={3.5} y={-5.5} z={0.5} color="#1e293b" />
    <Box w={16} d={3} h={3.5} y={5.5} z={0.5} color="#1e293b" />
    <Box w={18} d={11} h={5} z={3.5} color="#e2e8f0" finish="hull" />
    <Box w={7} d={9} h={5} x={5} z={8.5} color="#b45309" finish="foil" />
    {/* Glass cab + headlights */}
    <Box w={7} d={8.5} h={5.5} x={-4.5} z={8.5} color="#7dd3fc" finish="glass" opacity={0.9} />
    <Disc r={1.6} x={-9.5} y={-3} z={5.5} color="#22d3ee" glow="0 0 6px #22d3ee" />
    <Disc r={1.6} x={-9.5} y={3} z={5.5} color="#22d3ee" glow="0 0 6px #22d3ee" />
    {/* Sensor mast + status light */}
    <Box w={1.8} d={1.8} h={7} x={7} z={13.5} color="#94a3b8" />
    <Beacon x={7} z={21.5} color={working ? '#fb923c' : '#4ade80'} />
  </>
);
