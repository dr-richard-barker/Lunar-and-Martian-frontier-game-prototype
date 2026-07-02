import React, { useState, useEffect, useCallback, useRef } from 'react';
import Hexagon from './components/Hexagon';
import UIOverlay from './components/UIOverlay';
import BuildMenu from './components/BuildMenu';
import { GameState, BuildingType, ColonyEvent } from './types';
import { TICK_MS } from './constants';
import { newGame, tick, build, demolish } from './services/simulation';
import { saveGame, loadGame } from './services/storage';
import { nextLore } from './services/events';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => loadGame() ?? newGame());
  const [speed, setSpeed] = useState(1);
  const [selectedHexId, setSelectedHexId] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<ColonyEvent | null>(null);
  const [lore, setLore] = useState(nextLore());
  const [viewState, setViewState] = useState({ rotationX: 55, rotationZ: -25, zoom: 0.8 });

  const isDragging = useRef(false);
  const dragDistance = useRef(0);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Simulation loop ---
  useEffect(() => {
    if (speed === 0) return;
    const interval = setInterval(() => {
      setGameState(prev => {
        const result = tick(prev);
        if (result.event) {
          setActiveEvent(result.event);
          if (eventTimer.current) clearTimeout(eventTimer.current);
          eventTimer.current = setTimeout(() => setActiveEvent(null), 7000);
        }
        // Autosave every 5 sols
        if (result.state.sol % 5 === 0) saveGame(result.state);
        return result.state;
      });
    }, TICK_MS / speed);
    return () => clearInterval(interval);
  }, [speed]);

  // --- Rotating commander transmissions ---
  useEffect(() => {
    const interval = setInterval(() => setLore(nextLore()), 18000);
    return () => clearInterval(interval);
  }, []);

  // --- Camera controls ---
  const handleMouseDown = (e: React.MouseEvent) => {
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
    // Ignore clicks that were actually orbit drags
    if (dragDistance.current > 8) return;
    setSelectedHexId(prev => (prev === id ? null : id));
  }, []);

  const handleBuild = useCallback((hexId: number, type: BuildingType) => {
    setGameState(prev => {
      const next = build(prev, hexId, type);
      saveGame(next);
      return next;
    });
  }, []);

  const handleDemolish = useCallback((hexId: number) => {
    setGameState(prev => {
      const next = demolish(prev, hexId);
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

  const selectedHex = selectedHexId !== null
    ? gameState.board.find(h => h.id === selectedHexId) ?? null
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
                onSelect={handleSelectHex}
              />
            ))}
          </div>
        </div>
      </div>

      <UIOverlay
        gameState={gameState}
        speed={speed}
        onSetSpeed={setSpeed}
        onSave={handleSave}
        onNewColony={handleNewColony}
        activeEvent={activeEvent}
        lore={lore}
      />

      {selectedHex && (
        <div className="fixed inset-0 pointer-events-none z-20" onMouseDown={e => e.stopPropagation()}>
          <BuildMenu
            gameState={gameState}
            hex={selectedHex}
            onBuild={handleBuild}
            onDemolish={handleDemolish}
            onClose={() => setSelectedHexId(null)}
          />
        </div>
      )}
    </div>
  );
};

export default App;
