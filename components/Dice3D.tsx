
import React from 'react';

interface Dice3DProps {
  value: number | null;
  isRolling: boolean;
}

const Dice3D: React.FC<Dice3DProps> = ({ value, isRolling }) => {
  const getRotation = (val: number | null) => {
    if (isRolling || !val) return '';
    switch (val) {
      case 1: return 'rotateY(0deg) rotateX(0deg)';
      case 2: return 'rotateY(-90deg) rotateX(0deg)';
      case 3: return 'rotateY(-180deg) rotateX(0deg)';
      case 4: return 'rotateY(90deg) rotateX(0deg)';
      case 5: return 'rotateX(-90deg) rotateY(0deg)';
      case 6: return 'rotateX(90deg) rotateY(0deg)';
      default: return '';
    }
  };

  return (
    <div className="perspective-[600px] flex items-center justify-center h-24 w-24">
      <div 
        className={`dice ${isRolling ? 'rolling' : ''}`}
        style={{ transform: getRotation(value) }}
      >
        {/* Realistic pips could be added here, using simple numbers for clarity */}
        <div className="dice-face face-1 border-4 border-slate-800 bg-white">1</div>
        <div className="dice-face face-2 border-4 border-slate-800 bg-white">2</div>
        <div className="dice-face face-3 border-4 border-slate-800 bg-white">3</div>
        <div className="dice-face face-4 border-4 border-slate-800 bg-white">4</div>
        <div className="dice-face face-5 border-4 border-slate-800 bg-white">5</div>
        <div className="dice-face face-6 border-4 border-slate-800 bg-white">6</div>
      </div>
    </div>
  );
};

export default Dice3D;
