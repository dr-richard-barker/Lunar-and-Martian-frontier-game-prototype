import React, { useMemo } from 'react';
import { HexData, TerrainType } from '../types';
import { HEX_RADIUS, TERRAIN_STYLES } from '../constants';
import { BuildingModel, ConstructionSite } from './Structure3D';

export type SurgeKind = 'none' | 'ring' | 'gold';

/** Grainy regolith noise, inlined as SVG so it stays crisp at any zoom. */
const NOISE =
  'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27/><feColorMatrix type=%27matrix%27 values=%270 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0.6 0.6 0 0%27/></filter><rect width=%27120%27 height=%27120%27 filter=%27url(%23n)%27 opacity=%270.5%27/></svg>")';

/** Layered material per terrain: mineral pattern + directional shading + noise. */
const TERRAIN_SURFACE: Record<TerrainType, string> = {
  [TerrainType.REGOLITH]:
    `radial-gradient(circle at 35% 28%, rgba(203,213,225,0.28), transparent 55%), radial-gradient(circle at 70% 75%, rgba(2,6,23,0.35), transparent 60%), ${NOISE}`,
  [TerrainType.ICE]:
    `repeating-linear-gradient(64deg, rgba(224,242,254,0.4) 0 2px, transparent 2px 13px), repeating-linear-gradient(-40deg, rgba(186,230,253,0.25) 0 1.5px, transparent 1.5px 17px), radial-gradient(circle at 45% 40%, rgba(224,242,254,0.35), transparent 60%), ${NOISE}`,
  [TerrainType.ORES]:
    `repeating-linear-gradient(115deg, rgba(251,146,60,0.5) 0 2px, transparent 2px 16px), repeating-linear-gradient(28deg, rgba(153,27,27,0.5) 0 3px, transparent 3px 21px), radial-gradient(circle at 60% 55%, rgba(249,115,22,0.35), transparent 55%), ${NOISE}`,
  [TerrainType.SILICATES]:
    `repeating-conic-gradient(from 15deg, rgba(254,243,199,0.3) 0 16deg, rgba(146,64,14,0.3) 16deg 34deg), radial-gradient(circle at 50% 45%, rgba(253,230,138,0.3), transparent 62%), ${NOISE}`,
  [TerrainType.HE3]:
    `repeating-linear-gradient(32deg, rgba(167,139,250,0.4) 0 2px, transparent 2px 15px), repeating-linear-gradient(-58deg, rgba(232,121,249,0.25) 0 1.5px, transparent 1.5px 19px), radial-gradient(circle at 50% 55%, rgba(139,92,246,0.4), transparent 58%), ${NOISE}`,
  [TerrainType.CRATER]:
    `radial-gradient(circle at 50% 52%, rgba(2,6,23,0.75) 0%, rgba(2,6,23,0.35) 45%, transparent 70%), ${NOISE}`,
};

/** Subtle per-terrain elevation (px) — craters sink, mineral tiles rise. */
const ELEVATION: Record<TerrainType, number> = {
  [TerrainType.REGOLITH]: 0,
  [TerrainType.ICE]: 2,
  [TerrainType.ORES]: 4,
  [TerrainType.SILICATES]: 2,
  [TerrainType.HE3]: 5,
  [TerrainType.CRATER]: -7,
};

interface HexagonProps {
  data: HexData;
  selected: boolean;
  /** Tile is adjacent to the colony and open for construction. */
  frontier: boolean;
  /** Dice-roll match this sol: 'gold' when a building is surging, 'ring' for a bare match. */
  surge: SurgeKind;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
}

const Hexagon: React.FC<HexagonProps> = ({ data, selected, frontier, surge, onSelect, onHover }) => {
  const { q, r, terrain, building, construction, diceValue } = data;

  const x = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const y = HEX_RADIUS * 3 / 2 * r;

  const style = TERRAIN_STYLES[terrain];
  const depth = 35;

  const sides = Array.from({ length: 6 }).map((_, i) => {
    const angle = i * 60;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.sin(rad) * (HEX_RADIUS * 0.866);
    const ty = -Math.cos(rad) * (HEX_RADIUS * 0.866);
    return { angle, tx, ty };
  });

  // Generate terrain features once per hex
  const terrainFeatures = useMemo(() => {
    switch (terrain) {
      case TerrainType.REGOLITH:
      case TerrainType.CRATER:
        return Array.from({ length: terrain === TerrainType.CRATER ? 7 : 4 }).map((_, i) => (
          <div
            key={i}
            className="terrain-crater"
            style={{
              width: `${10 + Math.random() * 20}px`,
              height: `${10 + Math.random() * 20}px`,
              left: `${20 + Math.random() * 60}px`,
              top: `${20 + Math.random() * 80}px`,
            }}
          />
        ));
      case TerrainType.ICE:
        return Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="terrain-crystal"
            style={{
              left: `${25 + Math.random() * 50}px`,
              top: `${30 + Math.random() * 60}px`,
              opacity: 0.8,
              boxShadow: '0 0 10px rgba(14, 165, 233, 0.5)'
            }}
          />
        ));
      case TerrainType.ORES:
        return (
          <div
            style={{
              position: 'absolute',
              width: '60px', height: '60px',
              left: '22px', top: '30px',
              background: 'radial-gradient(circle, #f87171 0%, transparent 70%)',
              filter: 'blur(10px)',
              animation: 'pulse 3s infinite'
            }}
          />
        );
      case TerrainType.HE3:
        return (
          <div
            style={{
              position: 'absolute',
              width: '40px', height: '40px',
              left: '32px', top: '40px',
              background: '#8b5cf6',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              boxShadow: '0 0 20px #8b5cf6',
              opacity: 0.45,
            }}
          />
        );
      default: return null;
    }
  }, [terrain]);

  return (
    <div
      className="prism-container tile-drop group cursor-pointer"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        width: 0, height: 0,
        transform: `translateZ(${ELEVATION[terrain]}px)`,
        ['--elev' as string]: `${ELEVATION[terrain]}px`,
        animationDelay: `${(Math.abs(q) + Math.abs(r)) * 90}ms`,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      onMouseEnter={() => onHover(data.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Side Faces */}
      {sides.map((side, i) => (
        <div
          key={i}
          className="prism-face prism-side"
          style={{
            backgroundColor: style.color,
            filter: `brightness(${0.4 + (i * 0.1)})`,
            transform: `translate(-50%, -50%) translate3d(${side.tx}px, ${side.ty}px, -${depth / 2}px) rotateZ(${side.angle}deg) rotateX(90deg)`,
            border: '1px solid rgba(255,255,255,0.05)'
          }}
        />
      ))}

      {/* Top Layer - Terrain surface (flat decals only; clip-path flattens 3D) */}
      <div
        className="prism-face prism-top tile-surface transition-all duration-300 group-hover:brightness-110"
        style={{
          backgroundColor: style.color,
          transform: `translate(-50%, -50%) translateZ(0px)`,
          backgroundImage: TERRAIN_SURFACE[terrain],
        }}
      >
        {terrainFeatures}

        {/* Terrain icon when tile is empty */}
        {!building && !construction && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl opacity-50">{style.icon}</span>
          </div>
        )}

        {/* Catan-style yield token */}
        {diceValue !== null && (
          <div
            className={`num-token ${diceValue === 6 || diceValue === 8 ? 'num-token-hot' : ''} ${surge !== 'none' ? 'num-token-surge' : ''}`}
          >
            {diceValue}
          </div>
        )}

        {/* Construction progress decal */}
        {construction && (
          <div className="construction-decal">
            {Math.round(((construction.total - construction.remaining) / construction.total) * 100)}%
          </div>
        )}
      </div>

      {/* 3D structure — sibling of the clipped top face so it can extrude */}
      {(building || construction) && (
        <div
          className="structure-anchor"
          style={{ transform: 'translateZ(0.5px)' }}
        >
          <div key={building ?? 'site'} className="structure-pop" style={{ transformStyle: 'preserve-3d' }}>
            {building ? <BuildingModel type={building} /> : <ConstructionSite />}
          </div>
        </div>
      )}

      {/* Frontier tint — buildable border tiles */}
      {frontier && !building && !construction && (
        <div
          className="prism-face prism-top pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) translateZ(0.8px)`,
            background: 'rgba(56, 189, 248, 0.07)',
            border: '2px dashed rgba(56, 189, 248, 0.25)',
          }}
        />
      )}

      {/* Dice surge flash */}
      {surge !== 'none' && (
        <div
          className={`prism-face prism-top pointer-events-none ${surge === 'gold' ? 'surge-gold' : 'surge-ring'}`}
          style={{ transform: `translate(-50%, -50%) translateZ(1.2px)` }}
        />
      )}

      {/* Selection / Hover Glow */}
      <div
        className={`prism-face prism-top pointer-events-none transition-opacity duration-300 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
        style={{
          transform: `translate(-50%, -50%) translateZ(1.6px)`,
          boxShadow: selected ? '0 0 40px rgba(52, 211, 153, 0.6)' : '0 0 30px rgba(56, 189, 248, 0.4)',
          background: selected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.1)',
          border: selected ? '2px solid rgba(52, 211, 153, 0.8)' : 'none',
        }}
      />
    </div>
  );
};

export default React.memo(Hexagon);
