import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import UIOverlay from './components/UIOverlay';
import BuildMenu from './components/BuildMenu';
import CityPanel from './components/CityPanel';
import Board3D, { YieldPopup } from './components/Board3D';
import { GameState, BuildingType, ColonyEvent, CityProduct, ResourceKind } from './types';
import { TICK_MS, BUILDINGS, TERRAIN_STYLES, RESOURCE_STYLES } from './constants';
import {
  newGame, tick, orderConstruction, demolish, enqueueProduct, cancelQueueItem, isWithinReach,
  countBuildings, getActiveSet,
} from './services/simulation';
import { boardMap, hexKey, HEX_DIRS } from './services/hexgrid';
import { saveGame, loadGame } from './services/storage';
import { nextLore } from './services/events';
import { sfx, unlock, isMuted, setMuted } from './services/sound';
import { autopilotAct } from './services/autopilot';

export type SurgeKind = 'none' | 'ring' | 'gold';

let popupId = 0;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => loadGame() ?? newGame());
  const [speed, setSpeed] = useState(1);
  const [selectedHexId, setSelectedHexId] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<ColonyEvent | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lore, setLore] = useState(nextLore());
  const [muted, setMutedState] = useState(isMuted());
  const [hoveredHexId, setHoveredHexId] = useState<number | null>(null);
  const [popups, setPopups] = useState<YieldPopup[]>([]);
  const [autoplay, setAutoplay] = useState(() => {
    try { return localStorage.getItem('lf-autoplay') === '1'; } catch { return false; }
  });

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

        // Floating yield numbers over surged tiles (online buildings only).
        const roll = result.state.lastRoll ? result.state.lastRoll.d1 + result.state.lastRoll.d2 : null;
        const fresh: YieldPopup[] = [];
        const surgeActive = getActiveSet(result.state.board);
        if (roll !== null) {
          for (const hex of result.state.board) {
            if (hex.diceValue !== roll || !hex.building || !surgeActive.has(hex.id)) continue;
            const production = BUILDINGS[hex.building].production;
            if (!production) continue;
            const [kind, amount] = Object.entries(production)[0];
            fresh.push({
              id: popupId++,
              q: hex.q,
              r: hex.r,
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

  // --- Game actions ---
  const handleSelectHex = useCallback((id: number) => {
    if (id < 0) { setSelectedHexId(null); return; }
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

  // Maglev network state: which structures are online, and which way each
  // track segment connects (for rail rendering).
  const activeIds = useMemo(() => getActiveSet(gameState.board), [gameState.board]);
  const roadKeys = useMemo(() => {
    const keys = new Map<number, string>();
    const map = boardMap(gameState.board);
    for (const hex of gameState.board) {
      if (hex.building !== BuildingType.ROAD) continue;
      const dirs: number[] = [];
      HEX_DIRS.forEach((d, i) => {
        const n = map.get(hexKey({ q: hex.q + d.q, r: hex.r + d.r }));
        if (n && (n.building === BuildingType.ROAD || n.building === BuildingType.CITY)) dirs.push(i);
      });
      keys.set(hex.id, dirs.join(','));
    }
    return keys;
  }, [gameState.board]);

  const surgeFor = useCallback((hexId: number): SurgeKind => {
    const hex = gameState.board[hexId];
    if (rollSum === null || hex.diceValue !== rollSum) return 'none';
    if (hex.building && BUILDINGS[hex.building].production) return 'gold';
    return 'ring';
  }, [gameState.board, rollSum]);

  const selectedHex = selectedHexId !== null
    ? gameState.board.find(h => h.id === selectedHexId) ?? null
    : null;
  const cityIsSelected = selectedHex?.building === BuildingType.CITY;
  const hoveredHex = hoveredHexId !== null
    ? gameState.board.find(h => h.id === hoveredHexId) ?? null
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden" onPointerDown={unlock}>
      {/* Planetary Atmosphere Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,58,138,0.15)_0%,_transparent_70%)] pointer-events-none" />

      {/* WebGL board */}
      <Board3D
        gameState={gameState}
        selectedHexId={selectedHexId}
        frontierIds={frontierIds}
        activeIds={activeIds}
        roadKeys={roadKeys}
        surgeFor={surgeFor}
        popups={popups}
        autoplay={autoplay}
        onSelect={handleSelectHex}
        onHover={setHoveredHexId}
      />

      {/* Cinematic vignette */}
      <div className="vignette" />

      {/* Hovered-sector readout */}
      {hoveredHex && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-slate-900/85 border border-slate-700 rounded-full px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 backdrop-blur shadow-lg">
          Sector {hoveredHex.id} · {TERRAIN_STYLES[hoveredHex.terrain].label}
          {hoveredHex.diceValue !== null && <span className="text-amber-300"> · Yield {hoveredHex.diceValue}</span>}
          {hoveredHex.building && <span className="text-sky-300"> · {BUILDINGS[hoveredHex.building].name}</span>}
          {hoveredHex.building && !activeIds.has(hoveredHex.id) && <span className="text-red-400"> · OFFLINE</span>}
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
