import React, { useState } from 'react';
import { NewGameOptions } from '../types';
import { BOARD_SIZES, FACTION_PRESETS } from '../constants';

interface NewColonyDialogProps {
  onStart: (options: NewGameOptions) => void;
  onClose: () => void;
}

const NewColonyDialog: React.FC<NewColonyDialogProps> = ({ onStart, onClose }) => {
  const [radius, setRadius] = useState(5);
  const [aiCount, setAiCount] = useState(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
      <div className="hud-panel w-[26rem] bg-slate-900/95 border border-sky-700 rounded-2xl p-6 shadow-[0_0_60px_rgba(14,165,233,0.2)]">
        <h2 className="font-orbitron text-xl text-sky-400 mb-1">🚀 New Expedition</h2>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-5">
          Abandons the current colony and its save
        </p>

        {/* Map size */}
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Landing Zone</p>
        <div className="flex gap-2 mb-5">
          {BOARD_SIZES.map(size => (
            <button
              key={size.radius}
              onClick={() => setRadius(size.radius)}
              className={`flex-1 py-3 rounded-xl border transition-all text-center ${
                radius === size.radius
                  ? 'bg-sky-600/30 border-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="block text-xs font-bold">{size.label}</span>
              <span className="block text-[9px] font-mono mt-0.5">{size.tiles} tiles</span>
            </button>
          ))}
        </div>

        {/* Rivals */}
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
          Rival Colonies ({aiCount})
        </p>
        <div className="space-y-2 mb-3">
          {FACTION_PRESETS.slice(1).map((preset, i) => {
            const joined = i < aiCount;
            return (
              <button
                key={preset.name}
                onClick={() => setAiCount(joined ? i : i + 1)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  joined
                    ? 'bg-slate-800/70 border-slate-500'
                    : 'bg-slate-800/20 border-slate-800 opacity-45'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: preset.color, boxShadow: joined ? `0 0 8px ${preset.color}` : 'none' }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold" style={{ color: joined ? preset.color : undefined }}>
                    {preset.name}
                  </span>
                  <span className="block text-[9px] text-slate-400">{preset.blurb}</span>
                </span>
                <span className="text-[9px] font-mono text-slate-500">{joined ? 'LANDING' : 'STAND BY'}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-600 mb-5 leading-relaxed">
          Rivals build their own cities in their own colors, on their own maglev networks.
          Toggle a faction to set how many land alongside you.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 py-3 rounded-xl text-xs font-bold tracking-widest transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={() => onStart({ boardRadius: radius, aiCount })}
            className="flex-1 bg-sky-600 hover:bg-sky-500 border-b-4 border-sky-800 text-white py-3 rounded-xl text-xs font-orbitron tracking-widest transition-all shadow-[0_0_20px_rgba(2,132,199,0.4)]"
          >
            LAUNCH 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewColonyDialog;
