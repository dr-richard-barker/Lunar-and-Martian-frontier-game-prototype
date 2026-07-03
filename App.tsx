import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Hexagon, { SurgeKind } from './components/Hexagon';
import UIOverlay from './components/UIOverlay';
import BuildMenu from './components/BuildMenu';
import CityPanel from './components/CityPanel';
import { WorkerModel } from './components/Structure3D';
import { GameState, BuildingType, ColonyEvent, CityProduct, ResourceKind } from './types';
import { TICK_MS, HEX_RADIUS, BUILDINGS, TERRAIN_STYLES, RESOURCE_STYLES } from './constants';
import {
  newGame, tick, orderConstruction, demolish, enqueueProduct, cancelQueueItem, isWithinReach,
  countBuildings,
} from './services/simulation';
import { saveGame, loadGame } from './services/storage';
import { nextLore } from './services/events';
import { sfx, unlock, isMuted, setMuted } from './services/sound';
import { autopilotAct } from './services/autopilot';

interface YieldPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

let popupId = 0;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => loadGame() ?? newGame());
  const [speed, setSpeed] = useState(1);
  const [selectedHexId, setSelectedHexId] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<ColonyEvent | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lore, setLore] = useState(nextLore());
  const [viewState, setViewState] = useState({ rotationX: 55, rotationZ: -25, zoom: 0.8 });
  const [muted, setMutedState] = useState(isMuted());
  const [hoveredHexId, setHoveredHexId] = useState<number | null>(null);
  const [popups, setPopups] = useState<YieldPopup[]>([]);
  const [autoplay, setAutoplay] = useState(() => {
    try { return localStorage.getItem('lf-autoplay') === '1'; } catch { return false; }
  });

  const isDragging = useRef(false);
  const dragDistance = useRef(0);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Simulation loop ---
  useEffect(() => {
    if (speed === 0) return;
    const interval = setInterval(() => {
      // Browsers throttle hidden tabs to ~1 timer/min anyway; pause cleanly instead.
      if (document.hidden) return;
      setGameState(prev => {
        const result = tick(prev);
        // Autopilot: let the AI director place orders after the sol resolves.
        if (autoplay) result.state = autopilotAct(result.state);
        if (result.event) {
          setActiveEvent(result.event);
          sfx.alert();
          if (eventTimer.current) clearTimeout(eventTimer.current);
          eventTimer.current = setTimeout(() => setActiveEvent(null), 7000);
        }

        // Audio feedback for things that finished this sol.
        if (countBuildings(result.state.board) > countBuildings(prev.board)) sfx.complete();
        if (result.state.population > prev.population || result.state.units.length > prev.units.length) sfx.arrive();
        if (result.state.population < prev.population) sfx.loss();

        // Floating yield numbers over surged tiles.
        const roll = result.state.lastRoll ? result.state.lastRoll.d1 + result.state.lastRoll.d2 : null;
        const fresh: YieldPopup[] = [];
        if (roll !== null) {
          for (const hex of result.state.board) {
            if (hex.diceValue !== roll || !hex.building) continue;
            const production = BUILDINGS[hex.building].production;
            if (!production) continue;
            const [kind, amount] = Object.entries(production)[0];
            fresh.push({
              id: popupId++,
              x: HEX_RADIUS * Math.sqrt(3) * (hex.q + hex.r / 2),
              y: HEX_RADIUS * 3 / 2 * hex.r,
              text: `+${Math.round(amount * 2 * 10) / 10} ${RESOURCE_STYLES[kind as ResourceKind].icon}`,
              color: RESOURCE_STYLES[kind as ResourceKind].color,
            });
          }
        }
        setPopups(fresh);

        // Autosave every 5 sols
        if (result.state.sol % 5 === 0) saveGame(result.state);
        return result.state;
      });
    }, TICK_MS / speed);
    return () => clearInterval(interval);
  }, [speed, autoplay]);

  // --- Cinematic slow orbit while autopilot runs ---
  useEffect(() => {
    if (!autoplay) return;
    const interval = setInterval(() => {
      if (isDragging.current || document.hidden) return;
      setViewState(prev => ({ ...prev, rotationZ: prev.rotationZ + 0.18 }));
    }, 90);
    return () => clearInterval(interval);
  }, [autoplay]);

  // --- Dice roll animation on each new sol ---
  useEffect(() => {
    if (!gameState.lastRoll) return;
    setIsRolling(true);
    if (rollTimer.current) clearTimeout(rollTimer.current);
    rollTimer.current = setTimeout(() => setIsRolling(false), 550);
    return () => { if (rollTimer.current) clearTimeout(rollTimer.current); };
  }, [gameState.sol]);

  // --- Rotating commander transmissions ---
  useEffect(() => {
    const interval = setInterval(() => setLore(nextLore()), 18000);
    return () => clearInterval(interval);
  }, []);

  // --- Camera controls ---
  const handleMouseDown = (e: React.MouseEvent) => {
    unlock(); // WebAudio needs a user gesture before it can play
    isDragging.current = true;
    dragDistance.current = 0;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);
    setViewState(prev => ({
      ...prev,
      rotationZ: prev.rotationZ + dx * 0.4,
      rotationX: Math.max(15, Math.min(85, prev.rotationX - dy * 0.4)),
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);

  const handleWheel = (e: React.WheelEvent) => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(0.35, Math.min(2.5, prev.zoom - e.deltaY * 0.0008)),
    }));
  };

  // --- Game actions ---
  const handleSelectHex = useCallback((id: number) => {
    if (dragDistance.current > 8) return;
    sfx.click();
    setSelectedHexId(prev => (prev === id ? null : id));
  }, []);

  const handleBuild = useCallback((hexId: number, type: BuildingType) => {
    sfx.place();
    setGameState(prev => {
      const next = orderConstruction(prev, hexId, type);
      saveGame(next);
      return next;
    });
  }, []);

  const handleDemolish = useCallback((hexId: number) => {
    sfx.demolish();
    setGameState(prev => {
      const next = demolish(prev, hexId);
      saveGame(next);
      return next;
    });
  }, []);

  const handleEnqueue = useCallback((product: CityProduct) => {
    sfx.place();
    setGameState(prev => {
      const next = enqueueProduct(prev, product);
      saveGame(next);
      return next;
    });
  }, []);

  const handleCancelQueueItem = useCallback((itemId: number) => {
    sfx.click();
    setGameState(prev => {
      const next = cancelQueueItem(prev, itemId);
      saveGame(next);
      return next;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setMutedState(prev => {
      setMuted(!prev);
      return !prev;
    });
  }, []);

  const handleToggleAutoplay = useCallback(() => {
    setAutoplay(prev => {
      const next = !prev;
      try { localStorage.setItem('lf-autoplay', next ? '1' : '0'); } catch { /* ignore */ }
      if (next) {
        setSpeed(s => (s === 0 ? 1 : s));
        setSelectedHexId(null);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    setGameState(prev => {
      saveGame(prev);
      return { ...prev, logs: [...prev.logs, '[SYS] Colony state saved.'].slice(-30) };
    });
  }, []);

  const handleNewColony = useCallback(() => {
    if (!window.confirm('Abandon this colony and land a new expedition? Your current save will be overwritten.')) return;
    const fresh = newGame();
    saveGame(fresh);
    setSelectedHexId(null);
    setActiveEvent(null);
    setGameState(fresh);
  }, []);

  // --- Derived board annotations ---
  const rollSum = gameState.lastRoll ? gameState.lastRoll.d1 + gameState.lastRoll.d2 : null;

  const frontierIds = useMemo(() => {
    const ids = new Set<number>();
    for (const hex of gameState.board) {
      if (!hex.building && !hex.construction && isWithinReach(gameState.board, hex)) {
        ids.add(hex.id);
      }
    }
    return ids;
  }, [gameState.board]);

  const surgeFor = (hexId: number): SurgeKind => {
    const hex = gameState.board[hexId];
    if (rollSum === null || hex.diceValue !== rollSum) return 'none';
    if (hex.building && BUILDINGS[hex.building].production) return 'gold';
    return 'ring';
  };

  const selectedHex = selectedHexId !== null
    ? gameState.board.find(h => h.id === selectedHexId) ?? null
    : null;
  const cityIsSelected = selectedHex?.building === BuildingType.CITY;
  const hoveredHex = hoveredHexId !== null
    ? gameState.board.find(h => h.id === hoveredHexId) ?? null
    : null;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      {/* Planetary Atmosphere Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,58,138,0.15)_0%,_transparent_70%)] pointer-events-none" />

      <div
        className="w-full h-full flex items-center justify-center"
        style={{ perspective: '1500px' }}
      >
        <div
          className="relative transition-transform duration-500 ease-out"
          style={{
            transform: `rotateX(${viewState.rotationX}deg) rotateZ(${viewState.rotationZ}deg) scale(${viewState.zoom})`,
            transformStyle: 'preserve-3d',
            width: '1000px', height: '1000px',
            ['--rz' as string]: `${viewState.rotationZ}`,
          }}
        >
          {/* Base Shadow Floor */}
          <div
            className="absolute inset-0 rounded-full border-2 border-sky-500/20 shadow-[0_0_100px_rgba(56,189,248,0.1)]"
            style={{ transform: 'translateZ(-50px) scale(1.4)', background: 'radial-gradient(circle, rgba(2,6,23,0.8) 0%, transparent 80%)' }}
          />

          <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
            {gameState.board.map(hex => (
              <Hexagon
                key={hex.id}
                data={hex}
                selected={hex.id === selectedHexId}
                frontier={frontierIds.has(hex.id)}
                surge={surgeFor(hex.id)}
                onSelect={handleSelectHex}
                onHover={setHoveredHexId}
              />
            ))}

            {/* Floating yield numbers on dice surges */}
            {popups.map(p => (
              <div
                key={p.id}
                className="yield-popup"
                style={{
                  left: `calc(50% + ${p.x}px)`,
                  top: `calc(50% + ${p.y}px)`,
                  color: p.color,
                }}
              >
                {p.text}
              </div>
            ))}

            {/* Worker rover units */}
            {gameState.units.map(unit => {
              const ux = HEX_RADIUS * Math.sqrt(3) * (unit.q + unit.r / 2);
              const uy = HEX_RADIUS * 3 / 2 * unit.r;
              // Nudge idle rovers at the hub apart so they don't stack.
              const jitter = unit.state === 'idle'
                ? { x: Math.cos(unit.id * 2.4) * 26, y: Math.sin(unit.id * 2.4) * 26 }
                : { x: 0, y: 0 };
              return (
                <div
                  key={unit.id}
                  className="unit-anchor"
                  style={{
                    left: `calc(50% + ${ux + jitter.x}px)`,
                    top: `calc(50% + ${uy + jitter.y}px)`,
                  }}
                  title={`Worker Rover ${unit.id} — ${unit.state}`}
                >
                  <WorkerModel working={unit.state === 'constructing'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cinematic vignette */}
      <div className="vignette" />

      {/* Hovered-sector readout */}
      {hoveredHex && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-slate-900/85 border border-slate-700 rounded-full px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 backdrop-blur shadow-lg">
          Sector {hoveredHex.id} · {TERRAIN_STYLES[hoveredHex.terrain].label}
          {hoveredHex.diceValue !== null && <span className="text-amber-300"> · Yield {hoveredHex.diceValue}</span>}
          {hoveredHex.building && <span className="text-sky-300"> · {BUILDINGS[hoveredHex.building].name}</span>}
          {hoveredHex.construction && <span className="text-amber-400"> · Building {BUILDINGS[hoveredHex.construction.type].name}</span>}
        </div>
      )}

      <UIOverlay
        gameState={gameState}
        speed={speed}
        isRolling={isRolling}
        muted={muted}
        autoplay={autoplay}
        onToggleMute={handleToggleMute}
        onToggleAutoplay={handleToggleAutoplay}
        onSetSpeed={setSpeed}
        onSave={handleSave}
        onNewColony={handleNewColony}
        activeEvent={activeEvent}
        lore={lore}
      />

      {selectedHex && (
        <div className="fixed inset-0 pointer-events-none z-20" onMouseDown={e => e.stopPropagation()}>
          {cityIsSelected ? (
            <CityPanel
              gameState={gameState}
              onEnqueue={handleEnqueue}
              onCancelQueueItem={handleCancelQueueItem}
              onClose={() => setSelectedHexId(null)}
            />
          ) : (
            <BuildMenu
              gameState={gameState}
              hex={selectedHex}
              onBuild={handleBuild}
              onDemolish={handleDemolish}
              onClose={() => setSelectedHexId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default App;
