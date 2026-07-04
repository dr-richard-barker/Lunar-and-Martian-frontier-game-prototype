import React from 'react';
import { GameState, ResourceKind, ColonyEvent } from '../types';
import { RESOURCE_STYLES } from '../constants';
import { getPowerReport, getHousing, getRates, idleWorkers, countBuildings } from '../services/simulation';
import Dice3D from './Dice3D';

interface UIOverlayProps {
  gameState: GameState;
  speed: number;
  isRolling: boolean;
  muted: boolean;
  autoplay: boolean;
  onToggleMute: () => void;
  onToggleAutoplay: () => void;
  onSetSpeed: (speed: number) => void;
  onSave: () => void;
  onNewColony: () => void;
  activeEvent: ColonyEvent | null;
  lore: string;
}

const SPEEDS = [0, 1, 2, 4];

const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  speed,
  isRolling,
  muted,
  autoplay,
  onToggleMute,
  onToggleAutoplay,
  onSetSpeed,
  onSave,
  onNewColony,
  activeEvent,
  lore,
}) => {
  const player = gameState.factions[0];
  const power = getPowerReport(gameState.board, player);
  const housing = getHousing(gameState.board, player);
  const rates = getRates(gameState, player);
  const idle = idleWorkers(player).length;
  const rollSum = gameState.lastRoll ? gameState.lastRoll.d1 + gameState.lastRoll.d2 : null;
  const rivals = gameState.factions.slice(1);

  return (
    <div
      className="fixed inset-0 pointer-events-none flex flex-col justify-between p-6 z-10"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Top Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="hud-panel bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl pointer-events-auto shadow-2xl">
          <h1 className="text-2xl font-orbitron tracking-wider" style={{ color: player.color }}>{player.name}</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">Lunar Frontier · Sandbox Colony</p>
          <div className="mt-3 flex gap-5 text-center">
            <div>
              <p className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Sol</p>
              <p className="text-xl font-orbitron text-white">{gameState.sol}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Colonists</p>
              <p className="text-xl font-orbitron text-white">
                {player.population}<span className="text-xs text-slate-500">/{housing}</span>
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Rovers</p>
              <p className="text-xl font-orbitron text-white">
                {idle}<span className="text-xs text-slate-500">/{player.units.length}</span>
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Power</p>
              <p className={`text-xl font-orbitron ${power.factor < 1 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {power.generated - power.consumed >= 0 ? '+' : ''}{power.generated - power.consumed}
                <span className="text-xs text-slate-500"> MW</span>
              </p>
            </div>
          </div>
          {power.factor < 1 && (
            <p className="text-[10px] text-red-400 mt-2 font-bold animate-pulse">
              ⚠ GRID OVERLOAD — production at {Math.round(power.factor * 100)}%
            </p>
          )}
          {autoplay && (
            <p className="text-[10px] text-cyan-300 mt-2 font-bold tracking-[0.25em] animate-pulse">
              🤖 AUTOPILOT ENGAGED — DIRECTOR AI BUILDING COLONY
            </p>
          )}

          {/* Rival scoreboard */}
          {rivals.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/70 space-y-1.5">
              {rivals.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color, boxShadow: `0 0 6px ${f.color}` }} />
                  <span className="font-bold tracking-wide flex-1" style={{ color: f.color }}>{f.name}</span>
                  <span className="font-mono text-slate-400">👥 {f.population}</span>
                  <span className="font-mono text-slate-400">🏗 {countBuildings(gameState.board, f.id)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transmission Log */}
        <div className="hud-panel w-80 bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl pointer-events-auto shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comm Link</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="h-28 overflow-y-auto space-y-2 text-[11px] font-mono scrollbar-hide flex flex-col-reverse">
            <div>
              {gameState.logs.slice(-6).map((log, i) => (
                <div key={`${gameState.logs.length}-${i}`} className="text-slate-400 border-l-2 border-slate-700 pl-3 leading-relaxed mb-2">
                  {log}
                </div>
              ))}
              <div className="text-sky-400 border-l-2 border-sky-500 pl-3 italic">{`> ${lore}`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {activeEvent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] pointer-events-auto z-50 event-pop">
          <div className="flex items-center gap-4 text-amber-500 mb-4 border-b border-amber-500/30 pb-4">
            <span className="text-4xl">⚡</span>
            <div>
              <h2 className="text-2xl font-orbitron uppercase tracking-tight leading-none">{activeEvent.title}</h2>
              <p className="text-[10px] mt-1 text-amber-400 font-bold">MISSION CONTROL ALERT — ALL COLONIES AFFECTED</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed italic">"{activeEvent.description}"</p>
          <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Colony Impact</span>
            <p className="text-xs text-slate-200 mt-1">{activeEvent.effect}</p>
          </div>
        </div>
      )}

      {/* Bottom Footer: Resources, Dice & Controls */}
      <div className="flex justify-between items-end gap-4">
        {/* Resources */}
        <div className="hud-panel bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-5 rounded-3xl pointer-events-auto flex gap-7 shadow-2xl">
          {(Object.keys(RESOURCE_STYLES) as ResourceKind[]).map(kind => {
            const rate = rates[kind];
            return (
              <div key={kind} className="flex flex-col items-center group" title={RESOURCE_STYLES[kind].label}>
                <span className="text-2xl mb-1 transform group-hover:scale-125 transition-transform duration-300 cursor-help">
                  {RESOURCE_STYLES[kind].icon}
                </span>
                <span className="text-lg font-orbitron text-white">{Math.floor(player.resources[kind])}</span>
                <span className={`text-[9px] font-mono font-bold ${rate > 0.01 ? 'text-emerald-400' : rate < -0.01 ? 'text-red-400' : 'text-slate-600'}`}>
                  {rate > 0.01 ? '+' : ''}{Math.abs(rate) < 0.01 ? '—' : rate.toFixed(1)}
                </span>
                <span className="text-[8px] uppercase text-slate-500 font-black tracking-tighter mt-0.5">
                  {RESOURCE_STYLES[kind].label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Sol Dice */}
        <div className="flex flex-col items-center gap-1 pointer-events-auto">
          <div className="flex gap-2 items-center bg-slate-900/60 backdrop-blur-lg px-4 py-2 rounded-2xl border border-slate-700/50">
            <Dice3D value={gameState.lastRoll?.d1 ?? null} isRolling={isRolling} />
            <Dice3D value={gameState.lastRoll?.d2 ?? null} isRolling={isRolling} />
            <div className="ml-2 text-center w-14">
              <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest">Yield Scan</p>
              <p className={`text-2xl font-orbitron ${rollSum === 7 ? 'text-red-400' : 'text-amber-300'}`}>
                {rollSum ?? '—'}
              </p>
            </div>
          </div>
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
            Matching sectors yield double
          </p>
        </div>

        {/* Time & Session Controls */}
        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          <div className="flex gap-2">
            <button
              onClick={onToggleAutoplay}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest transition-all backdrop-blur border ${
                autoplay
                  ? 'bg-cyan-600/80 border-cyan-400 text-white shadow-[0_0_16px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-800/90 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
              title="Let the AI director build your colony while you watch"
            >
              🤖 {autoplay ? 'AUTO ON' : 'AUTOPLAY'}
            </button>
            <button
              onClick={onToggleMute}
              className="bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest transition-colors backdrop-blur"
              title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            >
              {muted ? '🔇 MUTED' : '🔊 SOUND'}
            </button>
            <button
              onClick={onSave}
              className="bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest transition-colors backdrop-blur"
            >
              💾 SAVE
            </button>
            <button
              onClick={onNewColony}
              className="bg-slate-800/90 hover:bg-red-900/60 border border-slate-600 hover:border-red-700 text-slate-300 px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest transition-colors backdrop-blur"
            >
              🚀 NEW COLONY
            </button>
          </div>
          <div className="flex gap-1 bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-2 rounded-2xl shadow-2xl">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`px-5 py-3 rounded-xl font-orbitron text-sm transition-all ${
                  speed === s
                    ? 'bg-sky-600 text-white shadow-[0_0_15px_rgba(2,132,199,0.5)]'
                    : 'bg-transparent text-slate-500 hover:text-white hover:bg-slate-800'
                }`}
              >
                {s === 0 ? '⏸' : `${s}×`}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest pr-1">
            Click your hub to train rovers · Click tiles to build
          </p>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
