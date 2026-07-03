import React from 'react';
import { GameState, HexData, BuildingType, ResourceKind } from '../types';
import { BUILDINGS, TERRAIN_STYLES, RESOURCE_STYLES } from '../constants';
import { canBuild, idleWorkers, isWithinReach } from '../services/simulation';

interface BuildMenuProps {
  gameState: GameState;
  hex: HexData;
  onBuild: (hexId: number, type: BuildingType) => void;
  onDemolish: (hexId: number) => void;
  onClose: () => void;
}

const BuildMenu: React.FC<BuildMenuProps> = ({ gameState, hex, onBuild, onDemolish, onClose }) => {
  const terrain = TERRAIN_STYLES[hex.terrain];
  const currentBuilding = hex.building ? BUILDINGS[hex.building] : null;
  const idle = idleWorkers(gameState.units).length;
  const withinReach = isWithinReach(gameState.board, hex);

  return (
    <div className="hud-panel panel-in absolute right-6 top-1/2 -translate-y-1/2 w-80 max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl pointer-events-auto p-5 z-40">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-700">
        <div>
          <h2 className="font-orbitron text-lg text-sky-400 flex items-center gap-2">
            <span>{terrain.icon}</span> Sector {hex.id}
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            {terrain.label}
            {hex.diceValue !== null && (
              <span className={`ml-2 font-bold ${hex.diceValue === 6 || hex.diceValue === 8 ? 'text-red-400' : 'text-slate-200'}`}>
                · Yield {hex.diceValue}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-slate-800 transition-colors"
        >
          ×
        </button>
      </div>

      {/* Under construction */}
      {hex.construction && (
        <div className="mb-4">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏗️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-300">{BUILDINGS[hex.construction.type].name}</p>
                <p className="text-[10px] text-slate-400">{hex.construction.remaining} sols of work remaining</p>
              </div>
            </div>
            <div className="h-1.5 bg-slate-900 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${((hex.construction.total - hex.construction.remaining) / hex.construction.total) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => onDemolish(hex.id)}
            className="w-full mt-3 bg-red-900/50 hover:bg-red-800/70 border border-red-700/50 text-red-300 text-xs font-bold py-2.5 rounded-xl transition-colors"
          >
            CANCEL CONSTRUCTION (refund 50%)
          </button>
        </div>
      )}

      {/* Occupied tile */}
      {currentBuilding && (
        <div className="mb-4">
          <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
            <span className="text-3xl">{currentBuilding.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-bold">{currentBuilding.name}</p>
              <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{currentBuilding.description}</p>
            </div>
          </div>
          {hex.building !== BuildingType.CITY && (
            <button
              onClick={() => onDemolish(hex.id)}
              className="w-full mt-3 bg-red-900/50 hover:bg-red-800/70 border border-red-700/50 text-red-300 text-xs font-bold py-2.5 rounded-xl transition-colors"
            >
              DEMOLISH (salvage 50% metal)
            </button>
          )}
        </div>
      )}

      {/* Unbuildable terrain */}
      {!currentBuilding && !hex.construction && !terrain.buildable && (
        <p className="text-xs text-slate-500 italic p-3 bg-slate-800/40 rounded-xl">
          This crater is too unstable for construction. Rovers can't even cross it.
        </p>
      )}

      {/* Out of reach */}
      {!currentBuilding && !hex.construction && terrain.buildable && !withinReach && (
        <p className="text-xs text-amber-400/80 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          🛤️ Off the maglev network. Structures only work next to the Colony Hub or a connected track — lay Maglev Track segments outward to reach this sector.
        </p>
      )}

      {/* Build options */}
      {!currentBuilding && !hex.construction && terrain.buildable && withinReach && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Construct</p>
            <p className={`text-[10px] font-mono ${idle > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              🚜 {idle} idle
            </p>
          </div>
          {(Object.keys(BUILDINGS) as BuildingType[])
            .filter(type => BUILDINGS[type].buildable)
            .map(type => {
              const def = BUILDINGS[type];
              const check = canBuild(gameState, hex, type);
              return (
                <button
                  key={type}
                  onClick={() => check.ok && onBuild(hex.id, type)}
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
                        <span className={`text-[10px] font-mono ${def.power >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {def.power >= 0 ? '+' : ''}{def.power} MW
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-snug mt-0.5">{def.description}</p>
                      <div className="flex gap-3 mt-1.5 items-center flex-wrap">
                        {Object.entries(def.cost).map(([kind, amount]) => (
                          <span key={kind} className="text-[10px] font-mono text-slate-300">
                            {RESOURCE_STYLES[kind as ResourceKind].icon} {amount}
                          </span>
                        ))}
                        {def.housing && (
                          <span className="text-[10px] font-mono text-sky-300">👥 +{def.housing}</span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">⏱ {def.buildSols}</span>
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
      )}
    </div>
  );
};

export default BuildMenu;
