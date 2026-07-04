import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import UIOverlay from './components/UIOverlay';
import BuildMenu from './components/BuildMenu';
import CityPanel from './components/CityPanel';
import Board3D, { YieldPopup } from './components/Board3D';
import NewColonyDialog from './components/NewColonyDialog';
import { GameState, BuildingType, ColonyEvent, CityProduct, ResourceKind, NewGameOptions } from './types';
import { TICK_MS, BUILDINGS, TERRAIN_STYLES, RESOURCE_STYLES } from './constants';
import {
  newGame, orderConstruction, demolish, enqueueProduct, cancelQueueItem, isWithinReach,
  countBuildings, getAllActiveIds,
} from './services/simulation';
import { advanceSol } from './services/world';
import { boardMap, hexKey, HEX_DIRS } from './services/hexgrid';
import { saveGame, loadGame } from './services/storage';
import { nextLore } from './services/events';
import { sfx, unlock, isMuted, setMuted } from './services/sound';
import { autopilotAct } from './services/autopilot';

export type SurgeKind = 'none' | 'ring' | 'gold';

let popupId = 0;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => loadGame() ?? newGame({ boardRadius: 5, aiCount: 3 }));
  const [showNewColony, setShowNewColony] = useState(false);
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
        // Advance every faction, then let the player's autopilot act if engaged.
        const result = advanceSol(prev);
        if (autoplay) result.state = autopilotAct(result.state);
        if (result.event) {
          setActiveEvent(result.event);
          sfx.alert();
          if (eventTimer.current) clearTimeout(eventTimer.current);
          eventTimer.current = setTimeout(() => setActiveEvent(null), 7000);
        }

        // Audio feedback for player things that finished this sol.
        const prevPlayer = prev.factions[0];
        const nextPlayer = result.state.factions[0];
        if (countBuildings(result.state.board, 0) > countBuildings(prev.board, 0)) sfx.complete();
        if (nextPlayer.population > prevPlayer.population || nextPlayer.units.length > prevPlayer.units.length) sfx.arrive();
        if (nextPlayer.population < prevPlayer.population) sfx.loss();

        // Floating yield numbers over surged tiles (online buildings only).
        const roll = result.state.lastRoll ? result.state.lastRoll.d1 + result.state.lastRoll.d2 : null;
        const fresh: YieldPopup[] = [];
        const surgeActive = getAllActiveIds(result.state);
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
      const next = orderConstruction(prev, 0, hexId, type);
      saveGame(next);
      return next;
    });
  }, []);

  const handleDemolish = useCallback((hexId: number) => {
    sfx.demolish();
    setGameState(prev => {
      const next = demolish(prev, 0, hexId);
      saveGame(next);
      return next;
    });
  }, []);

  const handleEnqueue = useCallback((product: CityProduct) => {
    sfx.place();
    setGameState(prev => {
      const next = enqueueProduct(prev, 0, product);
      saveGame(next);
      return next;
    });
  }, []);

  const handleCancelQueueItem = useCallback((itemId: number) => {
    sfx.click();
    setGameState(prev => {
      const next = cancelQueueItem(prev, 0, itemId);
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
    setShowNewColony(true);
  }, []);

  const handleStartExpedition = useCallback((options: NewGameOptions) => {
    const fresh = newGame(options);
    saveGame(fresh);
    setSelectedHexId(null);
    setActiveEvent(null);
    setShowNewColony(false);
    setGameState(fresh);
    sfx.place();
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
    const player = gameState.factions[0];
    for (const hex of gameState.board) {
      if (!hex.building && !hex.construction && isWithinReach(gameState.board, player, hex)) {
        ids.add(hex.id);
      }
    }
    return ids;
  }, [gameState.board, gameState.factions]);

  // Maglev network state: which structures are online (any faction), and
  // which way each track segment connects to its own faction's network.
  const activeIds = useMemo(() => getAllActiveIds(gameState), [gameState]);
  const roadKeys = useMemo(() => {
    const keys = new Map<number, string>();
    const map = boardMap(gameState.board);
    for (const hex of gameState.board) {
      if (hex.building !== BuildingType.ROAD) continue;
      const dirs: number[] = [];
      HEX_DIRS.forEach((d, i) => {
        const n = map.get(hexKey({ q: hex.q + d.q, r: hex.r + d.r }));
        if (n && n.owner === hex.owner && (n.building === BuildingType.ROAD || n.building === BuildingType.CITY)) dirs.push(i);
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
  const cityIsSelected = selectedHex?.building === BuildingType.CITY && selectedHex.owner === 0;
  const hoveredHex = hoveredHexId !== null
    ? gameState.board.find(h => h.id === hoveredHexId) ?? null
    : null;
  const hoveredOwner = hoveredHex?.owner !== null && hoveredHex?.owner !== undefined
    ? gameState.factions[hoveredHex.owner]
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
          {hoveredOwner && hoveredOwner.id !== 0 && <span style={{ color: hoveredOwner.color }}> · {hoveredOwner.name}</span>}
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

      {showNewColony && (
        <NewColonyDialog
          onStart={handleStartExpedition}
          onClose={() => setShowNewColony(false)}
        />
      )}

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
