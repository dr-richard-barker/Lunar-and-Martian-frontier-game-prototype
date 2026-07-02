import React, { useMemo } from 'react';
import { HexData, TerrainType, BuildingType } from '../types';
import { HEX_RADIUS, TERRAIN_STYLES, BUILDINGS } from '../constants';

interface HexagonProps {
  data: HexData;
  selected: boolean;
  onSelect: (id: number) => void;
}

const Hexagon: React.FC<HexagonProps> = ({ data, selected, onSelect }) => {
  const { q, r, terrain, building } = data;

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
              transform: 'translateZ(1px)'
            }}
          />
        ));
      case TerrainType.ICE:
        return Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="terrain-crystal"
            style={{
              left: `${30 + Math.random() * 40}px`,
              top: `${30 + Math.random() * 60}px`,
              transform: `translateZ(${10 + i * 5}px) rotateY(${i * 45}deg) rotateX(10deg)`,
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
              transform: 'translateZ(2px)',
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
              transform: 'translateZ(2px) rotateX(20deg)',
              boxShadow: '0 0 20px #8b5cf6',
              opacity: 0.5,
            }}
          />
        );
      default: return null;
    }
  }, [terrain]);

  const buildingDef = building ? BUILDINGS[building] : null;

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

      {/* Top Layer - Main Terrain */}
      <div
        className="prism-face prism-top transition-all duration-300 group-hover:brightness-110 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
        style={{
          backgroundColor: style.color,
          transform: `translate(-50%, -50%) translateZ(0px)`,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 2px, transparent 2px, transparent 6px)',
        }}
      >
        {terrainFeatures}

        {/* Terrain icon (only when empty) or Building */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'translateZ(10px)' }}>
          {buildingDef ? (
            <>
              <div className="building-pad" />
              <span className="text-4xl drop-shadow-2xl filter brightness-125" style={{ transform: 'translateZ(14px)' }}>
                {buildingDef.icon}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-tighter text-white/90 bg-slate-900/70 px-1.5 py-0.5 rounded mt-1" style={{ transform: 'translateZ(14px)' }}>
                {buildingDef.name}
              </span>
            </>
          ) : (
            <span className="text-2xl opacity-70 drop-shadow-2xl">{style.icon}</span>
          )}
        </div>
      </div>

      {/* Selection / Hover Glow */}
      <div
        className={`prism-face prism-top pointer-events-none transition-opacity duration-300 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
        style={{
          transform: `translate(-50%, -50%) translateZ(1px)`,
          boxShadow: selected ? '0 0 40px rgba(52, 211, 153, 0.6)' : '0 0 30px rgba(56, 189, 248, 0.4)',
          background: selected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.1)',
          border: selected ? '2px solid rgba(52, 211, 153, 0.8)' : 'none',
        }}
      />
    </div>
  );
};

export default React.memo(Hexagon);
