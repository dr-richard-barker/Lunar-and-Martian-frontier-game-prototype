import React, { useMemo } from 'react';
import { HexData, TerrainType } from '../types';
import { HEX_RADIUS, TERRAIN_STYLES } from '../constants';
import { BuildingModel, ConstructionSite } from './Structure3D';

export type SurgeKind = 'none' | 'ring' | 'gold';

interface HexagonProps {
  data: HexData;
  selected: boolean;
  /** Tile is adjacent to the colony and open for construction. */
  frontier: boolean;
  /** Dice-roll match this sol: 'gold' when a building is surging, 'ring' for a bare match. */
  surge: SurgeKind;
  onSelect: (id: number) => void;
}

const Hexagon: React.FC<HexagonProps> = ({ data, selected, frontier, surge, onSelect }) => {
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
      className="prism-container group cursor-pointer"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        width: 0, height: 0,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
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
        className="prism-face prism-top transition-all duration-300 group-hover:brightness-110 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: style.color,
          transform: `translate(-50%, -50%) translateZ(0px)`,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 2px, transparent 2px, transparent 6px)',
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
          {building ? <BuildingModel type={building} /> : <ConstructionSite />}
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
