import React from 'react';

interface Dice3DProps {
  value: number | null;
  isRolling: boolean;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

const DiceFace: React.FC<{ value: number; className: string }> = ({ value, className }) => (
  <div className={`dice-face ${className}`}>
    {PIPS[value].map(([x, y], i) => (
      <span key={i} className="dice-pip" style={{ left: `${x}%`, top: `${y}%` }} />
    ))}
  </div>
);

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
    <div className="dice-stage">
      <div
        className={`dice ${isRolling ? 'rolling' : ''}`}
        style={{ transform: getRotation(value) }}
      >
        <DiceFace value={1} className="face-1" />
        <DiceFace value={2} className="face-2" />
        <DiceFace value={3} className="face-3" />
        <DiceFace value={4} className="face-4" />
        <DiceFace value={5} className="face-5" />
        <DiceFace value={6} className="face-6" />
      </div>
    </div>
  );
};

export default Dice3D;
