
import React from 'react';
import { GameState, ResourceType } from '../types';
import { RESOURCE_STYLES } from '../constants';
import Dice3D from './Dice3D';

interface UIOverlayProps {
  gameState: GameState;
  onRollDice: () => void;
  onEndTurn: () => void;
  isRolling: boolean;
  solarEvent: any | null;
  lore: string;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, 
  onRollDice, 
  onEndTurn, 
  isRolling,
  solarEvent,
  lore 
}) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // We show two dice
  const die1 = gameState.lastDiceRoll ? Math.ceil(gameState.lastDiceRoll / 2) : null;
  const die2 = gameState.lastDiceRoll ? gameState.lastDiceRoll - (die1 || 0) : null;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl pointer-events-auto shadow-2xl">
          <h1 className="text-2xl font-orbitron text-sky-400 tracking-wider">FRONTIER MISSION</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">Planetary Grid Alpha-9</p>
          <div className="mt-4 flex gap-4">
            {gameState.players.map((p, idx) => (
              <div 
                key={p.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-500 ${
                  idx === gameState.currentPlayerIndex 
                    ? 'bg-slate-700/50 border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.2)] scale-105' 
                    : 'bg-slate-800/30 border-slate-700 opacity-60 scale-95'
                }`}
              >
                <div className={`w-4 h-4 rounded-full shadow-lg`} style={{ backgroundColor: p.color }} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-tighter">{p.name}</span>
                  <span className="text-[10px] text-sky-300 font-orbitron">VICTORY: {p.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transmission Log */}
        <div className="w-80 bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl pointer-events-auto shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comm Link</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="h-28 overflow-y-auto space-y-2 text-[11px] font-mono scrollbar-hide">
            {gameState.logs.slice(-5).map((log, i) => (
              <div key={i} className="text-slate-400 border-l-2 border-slate-700 pl-3 leading-relaxed">
                <span className="text-slate-600 mr-2">[{10 + i}:00]</span> {log}
              </div>
            ))}
            <div className="text-sky-400 animate-pulse mt-2 border-l-2 border-sky-500 pl-3">{`> ${lore}`}</div>
          </div>
        </div>
      </div>

      {/* Solar Event Modal */}
      {solarEvent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] pointer-events-auto z-50 transform transition-all duration-500 animate-in fade-in zoom-in">
          <div className="flex items-center gap-4 text-amber-500 mb-4 border-b border-amber-500/30 pb-4">
            <span className="text-4xl">⚡</span>
            <div>
              <h2 className="text-2xl font-orbitron uppercase tracking-tight leading-none">{solarEvent.title}</h2>
              <p className="text-[10px] mt-1 text-amber-400 font-bold">ATMOSPHERIC ALERT</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed italic">"{solarEvent.description}"</p>
          <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
             <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Mission Impact</span>
             <p className="text-xs text-slate-200 mt-1">{solarEvent.effect}</p>
          </div>
        </div>
      )}

      {/* Bottom Footer: Resources & Actions */}
      <div className="flex justify-between items-end">
        {/* Resources */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-5 rounded-3xl pointer-events-auto flex gap-8 shadow-2xl">
          {Object.entries(currentPlayer.resources).map(([type, count]) => (
            <div key={type} className="flex flex-col items-center group">
              <span className="text-3xl mb-1 transform group-hover:scale-125 transition-transform duration-300 cursor-help" title={type}>
                {RESOURCE_STYLES[type as ResourceType].icon}
              </span>
              <span className="text-xl font-orbitron text-white">{count}</span>
              <span className="text-[9px] uppercase text-slate-500 font-black tracking-tighter">{type}</span>
            </div>
          ))}
        </div>

        {/* Main Controls */}
        <div className="flex items-end gap-6 pointer-events-auto">
          {/* Dice Area */}
          <div className="flex gap-2 items-center bg-slate-900/50 backdrop-blur-lg p-3 rounded-2xl border border-slate-700/50">
            <Dice3D value={die1} isRolling={isRolling} />
            <Dice3D value={die2} isRolling={isRolling} />
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onRollDice}
              disabled={isRolling || gameState.lastDiceRoll !== null}
              className={`py-4 px-10 rounded-2xl font-orbitron text-lg flex flex-col items-center justify-center border-b-4 transition-all duration-300 ${
                gameState.lastDiceRoll === null 
                  ? 'bg-sky-600 border-sky-800 hover:bg-sky-500 hover:scale-105 shadow-[0_5px_20px_rgba(2,132,199,0.4)]' 
                  : 'bg-slate-700 border-slate-900 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="text-[10px] tracking-[0.3em] font-bold opacity-70">INITIATE</span>
              ROLL SCAN
            </button>
            <div className="flex gap-2">
               <button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg text-xs"
              >
                BUILD
              </button>
              <button 
                onClick={onEndTurn}
                disabled={gameState.lastDiceRoll === null}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all text-xs border-b-4 ${
                  gameState.lastDiceRoll !== null 
                    ? 'bg-slate-700 border-slate-900 hover:bg-slate-600 text-white shadow-lg' 
                    : 'bg-slate-800 border-slate-950 text-slate-600 cursor-not-allowed'
                }`}
              >
                NEXT TURN
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Help text */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 flex flex-col items-center gap-1 text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-slate-900/40 p-2 rounded-full border border-slate-800 vertical-text">
        <span>Drag to Orbit</span>
        <span className="w-1 h-12 bg-slate-700 my-2 rounded-full"></span>
        <span>Scroll to Zoom</span>
      </div>
    </div>
  );
};

export default UIOverlay;
