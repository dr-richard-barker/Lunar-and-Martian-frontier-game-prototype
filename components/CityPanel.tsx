import React from 'react';
import { GameState, CityProduct, ResourceKind } from '../types';
import { CITY_PRODUCTS, RESOURCE_STYLES, MAX_WORKERS } from '../constants';
import { canEnqueue, getHousing, getPowerReport, idleWorkers } from '../services/simulation';

interface CityPanelProps {
  gameState: GameState;
  onEnqueue: (product: CityProduct) => void;
  onCancelQueueItem: (itemId: number) => void;
  onClose: () => void;
}

const CityPanel: React.FC<CityPanelProps> = ({ gameState, onEnqueue, onCancelQueueItem, onClose }) => {
  const power = getPowerReport(gameState.board);
  const housing = getHousing(gameState.board);
  const idle = idleWorkers(gameState.units).length;

  return (
    <div className="hud-panel panel-in absolute right-6 top-1/2 -translate-y-1/2 w-80 max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-sky-700 rounded-2xl shadow-[0_0_40px_rgba(14,165,233,0.15)] pointer-events-auto p-5 z-40">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-700">
        <div>
          <h2 className="font-orbitron text-lg text-sky-400 flex items-center gap-2">
            <span>🏛️</span> Colony Hub
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{gameState.colonyName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-slate-800 transition-colors"
        >
          ×
        </button>
      </div>

      {/* City stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest">Colonists</p>
          <p className="text-sm font-orbitron text-white">{gameState.population}/{housing}</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest">Power</p>
          <p className={`text-sm font-orbitron ${power.factor < 1 ? 'text-red-400' : 'text-emerald-400'}`}>
            {power.generated - power.consumed >= 0 ? '+' : ''}{power.generated - power.consumed}
          </p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest">Rovers</p>
          <p className="text-sm font-orbitron text-white">
            {idle}<span className="text-slate-500">/{gameState.units.length}</span>
            <span className="text-[9px] text-slate-500"> idle</span>
          </p>
        </div>
      </div>

      {/* Production options */}
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Production</p>
      <div className="space-y-2 mb-4">
        {(Object.keys(CITY_PRODUCTS) as CityProduct[]).map(product => {
          const def = CITY_PRODUCTS[product];
          const check = canEnqueue(gameState, product);
          return (
            <button
              key={product}
              onClick={() => check.ok && onEnqueue(product)}
              disabled={!check.ok}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                check.ok
                  ? 'bg-slate-800/60 border-slate-600 hover:border-sky-500 hover:bg-slate-700/60 cursor-pointer'
                  : 'bg-slate-800/20 border-slate-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{def.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">{def.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">⏱ {def.buildSols} sols</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-snug mt-0.5">{def.description}</p>
                  <div className="flex gap-3 mt-1.5 items-center flex-wrap">
                    {Object.entries(def.cost).map(([kind, amount]) => (
                      <span key={kind} className="text-[10px] font-mono text-slate-300">
                        {RESOURCE_STYLES[kind as ResourceKind].icon} {amount}
                      </span>
                    ))}
                    {def.popCost && <span className="text-[10px] font-mono text-amber-300">👥 -{def.popCost}</span>}
                    {def.popGain && <span className="text-[10px] font-mono text-emerald-300">👥 +{def.popGain}</span>}
                  </div>
                  {!check.ok && check.reason && (
                    <p className="text-[9px] text-red-400 mt-1">{check.reason}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Production queue */}
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
        Queue ({gameState.cityQueue.length})
      </p>
      {gameState.cityQueue.length === 0 ? (
        <p className="text-xs text-slate-600 italic p-3 bg-slate-800/40 rounded-xl">
          Assembly bays idle. Queue up a rover or shuttle.
        </p>
      ) : (
        <div className="space-y-2">
          {gameState.cityQueue.map((item, idx) => {
            const def = CITY_PRODUCTS[item.product];
            const progress = idx === 0
              ? Math.round(((def.buildSols - item.remaining) / def.buildSols) * 100)
              : 0;
            return (
              <div key={item.id} className="flex items-center gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700">
                <span className="text-xl">{def.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold">{def.name}</span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {idx === 0 ? `${item.remaining} sols` : 'queued'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => onCancelQueueItem(item.id)}
                  className="text-slate-500 hover:text-red-400 text-sm px-1.5 transition-colors"
                  title="Cancel and refund"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-slate-600 mt-4 leading-relaxed">
        Rovers build everything on the frontier. Max fleet: {MAX_WORKERS}. Shuttles bring colonists — make sure there's air for them.
      </p>
    </div>
  );
};

export default CityPanel;
