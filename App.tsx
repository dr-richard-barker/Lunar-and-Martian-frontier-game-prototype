
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Hexagon from './components/Hexagon';
import UIOverlay from './components/UIOverlay';
import { GameState, ResourceType, HexData } from './types';
import { INITIAL_RESOURCES } from './constants';
import { getSolarEvent, getMissionLore } from './services/geminiService';

const BOARD_RADIUS = 3;

const generateInitialBoard = (): HexData[] => {
  const hexes: HexData[] = [];
  let idCounter = 0;
  const resourceTypes = [
    ResourceType.ICE, ResourceType.ICE, ResourceType.ICE,
    ResourceType.REGOLITH, ResourceType.REGOLITH, ResourceType.REGOLITH, ResourceType.REGOLITH,
    ResourceType.SILICATES, ResourceType.SILICATES, ResourceType.SILICATES, ResourceType.SILICATES,
    ResourceType.ORES, ResourceType.ORES, ResourceType.ORES,
    ResourceType.HE3, ResourceType.HE3,
    ResourceType.DESERT
  ];
  const diceValues = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  
  resourceTypes.sort(() => Math.random() - 0.5);
  diceValues.sort(() => Math.random() - 0.5);

  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS); r <= Math.min(BOARD_RADIUS, -q + BOARD_RADIUS); r++) {
      const type = resourceTypes.pop() || ResourceType.DESERT;
      const value = type === ResourceType.DESERT ? 7 : (diceValues.pop() || 7);
      hexes.push({ id: idCounter++, q, r, type, value });
    }
  }
  return hexes;
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    players: [
      { id: '1', name: 'LUNA-1 CORP', color: '#3b82f6', resources: { ...INITIAL_RESOURCES }, score: 2 },
      { id: '2', name: 'MARS-X INITIATIVE', color: '#ef4444', resources: { ...INITIAL_RESOURCES }, score: 2 },
    ],
    currentPlayerIndex: 0,
    board: generateInitialBoard(),
    turn: 1,
    lastDiceRoll: null,
    logs: ['[INIT] Connection secure.', '[SYS] Terrestrial grid loaded.'],
  });

  const [isRolling, setIsRolling] = useState(false);
  const [solarEvent, setSolarEvent] = useState<any>(null);
  const [lore, setLore] = useState("Establishing secure link...");
  const [viewState, setViewState] = useState({ rotationX: 55, rotationZ: -25, zoom: 0.9 });

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const fetchLore = async () => {
      const msg = await getMissionLore("The Lunar Mare");
      setLore(msg);
    };
    fetchLore();
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setViewState(prev => ({
      ...prev,
      rotationZ: prev.rotationZ + dx * 0.4,
      rotationX: Math.max(15, Math.min(85, prev.rotationX - dy * 0.4)),
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', () => { isDragging.current = false; });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', () => {});
    };
  }, [handleMouseMove]);

  const handleWheel = (e: React.WheelEvent) => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(0.4, Math.min(2.5, prev.zoom - e.deltaY * 0.0008)),
    }));
  };

  const handleRollDice = async () => {
    setIsRolling(true);
    setSolarEvent(null);
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const roll = d1 + d2;
    
    setGameState(prev => {
      const updatedPlayers = prev.players.map((player) => {
        const newResources = { ...player.resources };
        prev.board.forEach(hex => {
          if (hex.value === roll && hex.type !== ResourceType.DESERT) {
            newResources[hex.type] += 1;
          }
        });
        return { ...player, resources: newResources };
      });
      return {
        ...prev,
        players: updatedPlayers,
        lastDiceRoll: roll,
        logs: [...prev.logs, `Scanner active: Yielding from sector ${roll}`].slice(-8),
      };
    });
    setIsRolling(false);

    if (roll === 7 || Math.random() > 0.85) {
      const event = await getSolarEvent(`Turn ${gameState.turn}, Roll ${roll}`);
      setSolarEvent(event);
      setTimeout(() => setSolarEvent(null), 7000);
    }
  };

  const handleEndTurn = useCallback(async () => {
    setGameState(prev => ({
      ...prev,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      turn: prev.turn + 1,
      lastDiceRoll: null,
    }));
    const msg = await getMissionLore(gameState.currentPlayerIndex === 0 ? "Surface Expedition" : "Deep Crater Ops");
    setLore(msg);
  }, [gameState.currentPlayerIndex]);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      {/* Planetary Atmosphere Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(30,58,138,0.15)_0%,_transparent_70%)] pointer-events-none" />
      
      <div 
        className="w-full h-full flex items-center justify-center pointer-events-none"
        style={{ perspective: '1500px' }}
      >
        <div 
          className="relative transition-transform duration-500 ease-out"
          style={{
            transform: `rotateX(${viewState.rotationX}deg) rotateZ(${viewState.rotationZ}deg) scale(${viewState.zoom})`,
            transformStyle: 'preserve-3d',
            width: '800px', height: '800px',
          }}
        >
          {/* Base Shadow Floor */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-sky-500/20 shadow-[0_0_100px_rgba(56,189,248,0.1)]"
            style={{ transform: 'translateZ(-50px) scale(1.4)', background: 'radial-gradient(circle, rgba(2,6,23,0.8) 0%, transparent 80%)' }}
          />

          <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
            {gameState.board.map(hex => (
              <Hexagon key={hex.id} data={hex} onClick={() => {}} />
            ))}
          </div>
        </div>
      </div>

      <UIOverlay 
        gameState={gameState} 
        onRollDice={handleRollDice} 
        onEndTurn={handleEndTurn}
        isRolling={isRolling}
        solarEvent={solarEvent}
        lore={lore}
      />
    </div>
  );
};

export default App;
