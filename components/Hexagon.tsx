
import React, { useMemo } from 'react';
import { HexData, ResourceType } from '../types';
import { HEX_RADIUS, RESOURCE_STYLES } from '../constants';

interface HexagonProps {
  data: HexData;
  onClick: () => void;
}

const Hexagon: React.FC<HexagonProps> = ({ data, onClick }) => {
  const { q, r, type, value } = data;
  
  const x = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const y = HEX_RADIUS * 3/2 * r;
  
  const style = RESOURCE_STYLES[type];
  const depth = 35; // Increased depth for "game piece" feel

  const sides = Array.from({ length: 6 }).map((_, i) => {
    const angle = i * 60;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.sin(rad) * (HEX_RADIUS * 0.866);
    const ty = -Math.cos(rad) * (HEX_RADIUS * 0.866);
    return { angle, tx, ty };
  });

  // Generate terrain features once per hex
  const terrainFeatures = useMemo(() => {
    switch(type) {
      case ResourceType.REGOLITH:
        return Array.from({ length: 5 }).map((_, i) => (
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
      case ResourceType.ICE:
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
      case ResourceType.ORES:
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
      case ResourceType.HE3:
        return (
          <div 
            style={{
              position: 'absolute',
              width: '40px', height: '40px',
              left: '32px', top: '40px',
              background: '#8b5cf6',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              transform: 'translateZ(15px) rotateX(20deg)',
              boxShadow: '0 0 20px #8b5cf6',
              border: '2px solid white'
            }}
          />
        );
      default: return null;
    }
  }, [type]);

  return (
    <div 
      className="prism-container group cursor-pointer"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        width: 0, height: 0,
      }}
      onClick={onClick}
    >
      {/* Side Faces with Plastic Texture */}
      {sides.map((side, i) => (
        <div 
          key={i}
          className="prism-face prism-side"
          style={{
            backgroundColor: style.color,
            filter: `brightness(${0.4 + (i * 0.1)})`,
            transform: `translate(-50%, -50%) translate3d(${side.tx}px, ${side.ty}px, -${depth/2}px) rotateZ(${side.angle}deg) rotateX(90deg)`,
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
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
          backgroundSize: '30px',
          backgroundBlendMode: 'overlay'
        }}
      >
        {/* Terrain Sculpting */}
        {terrainFeatures}

        {/* Resource Icon & Dice Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'translateZ(10px)' }}>
          <span className="text-3xl mb-1 drop-shadow-2xl filter brightness-125">{style.icon}</span>
          {type !== ResourceType.DESERT && (
            <div className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center border-2 border-slate-400 shadow-xl">
              <span className="text-slate-900 font-black text-sm">{value}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Hover Selection Glow */}
      <div className="prism-face prism-top opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
        style={{
          transform: `translate(-50%, -50%) translateZ(1px)`,
          boxShadow: '0 0 30px rgba(56, 189, 248, 0.4)',
          background: 'rgba(56, 189, 248, 0.1)'
        }}
      />
    </div>
  );
};

export default Hexagon;
