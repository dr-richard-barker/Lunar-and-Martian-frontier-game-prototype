import React, { useMemo, useState } from 'react';
import { GameState } from '../types';

/**
 * Colony performance dashboard — compares every faction's strategy over
 * time with SVG line charts. Faction identity colors are kept (they match
 * the board), with per-faction dash patterns, direct end labels, and a
 * hover readout as secondary encoding for colorblind safety.
 */

const DASHES = ['', '7 4', '2 4', '9 3 2 3'];

function shortName(name: string, id: number): string {
  if (id === 0) return 'ALPHA';
  const parts = name.split(' ');
  return parts[0] === 'THE' ? parts[1] : parts[0];
}

interface Series {
  name: string;
  color: string;
  dash: string;
  values: number[];
}

interface LineChartProps {
  title: string;
  sols: number[];
  series: Series[];
}

const W = 380, H = 170;
const PAD = { l: 40, r: 72, t: 14, b: 22 };

const LineChart: React.FC<LineChartProps> = ({ title, sols, series }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = useMemo(() => {
    const m = Math.max(1, ...series.flatMap(s => s.values));
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [series]);

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (sols.length <= 1 ? 0 : (i / (sols.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD.l) / iw) * (sols.length - 1));
    setHoverIdx(Math.max(0, Math.min(sols.length - 1, idx)));
  };

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{title}</p>
      {sols.length < 2 ? (
        <p className="text-[10px] text-slate-600 italic h-[150px] flex items-center justify-center">
          Collecting telemetry — check back in a few sols…
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Recessive grid */}
            {[0, 0.5, 1].map(t => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(max * t)} y2={y(max * t)} stroke="#1e293b" strokeWidth="1" />
                <text x={PAD.l - 5} y={y(max * t) + 3} textAnchor="end" fontSize="8" fill="#64748b">
                  {Math.round(max * t)}
                </text>
              </g>
            ))}
            <text x={PAD.l} y={H - 8} fontSize="8" fill="#64748b">Sol {sols[0]}</text>
            <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="8" fill="#64748b">Sol {sols[sols.length - 1]}</text>

            {/* Series lines + end labels */}
            {series.map(s => {
              const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              const last = s.values[s.values.length - 1];
              return (
                <g key={s.name}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeDasharray={s.dash}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle cx={x(s.values.length - 1)} cy={y(last)} r="3" fill={s.color} stroke="#0f172a" strokeWidth="1.5" />
                  <text x={W - PAD.r + 8} y={y(last) + 3} fontSize="8" fontWeight="700" fill="#cbd5e1">
                    {s.name} {Math.round(last)}
                  </text>
                </g>
              );
            })}

            {/* Hover crosshair */}
            {hoverIdx !== null && (
              <g>
                <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.t} y2={PAD.t + ih} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                {series.map(s => (
                  <circle key={s.name} cx={x(hoverIdx)} cy={y(s.values[hoverIdx])} r="3" fill={s.color} stroke="#0f172a" strokeWidth="1.5" />
                ))}
              </g>
            )}
          </svg>

          {/* Hover readout */}
          {hoverIdx !== null && (
            <div className="absolute top-1 right-1 bg-slate-900/95 border border-slate-700 rounded-lg px-2.5 py-1.5 pointer-events-none">
              <p className="text-[9px] font-bold text-slate-400 mb-0.5">Sol {sols[hoverIdx]}</p>
              {series.map(s => (
                <p key={s.name} className="text-[9px] text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.name}: <span className="font-mono">{Math.round(s.values[hoverIdx])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DashboardPanelProps {
  gameState: GameState;
  onClose: () => void;
}

const METRICS: { key: 'p' | 'b' | 'c' | 's'; title: string }[] = [
  { key: 'p', title: 'Population' },
  { key: 'b', title: 'Structures' },
  { key: 'c', title: 'Credits' },
  { key: 's', title: 'Life-Support Reserve (weakest stock)' },
];

const DashboardPanel: React.FC<DashboardPanelProps> = ({ gameState, onClose }) => {
  const history = gameState.history ?? [];
  const sols = history.map(h => h.sol);

  const chartFor = (key: 'p' | 'b' | 'c' | 's'): Series[] =>
    gameState.factions.map(f => ({
      name: shortName(f.name, f.id),
      color: f.color,
      dash: DASHES[f.id % DASHES.length],
      values: history.map(h => h.f[f.id]?.[key] ?? 0),
    }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
      <div className="hud-panel w-[52rem] max-w-[94vw] max-h-[90vh] overflow-y-auto bg-slate-900/95 border border-sky-700 rounded-2xl p-6 shadow-[0_0_60px_rgba(14,165,233,0.2)]">
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-700">
          <div>
            <h2 className="font-orbitron text-xl text-sky-400">📊 Colony Performance</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">
              Strategy telemetry · sampled every 2 sols
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            title="Close dashboard"
          >
            ×
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {gameState.factions.map(f => (
            <span key={f.id} className="flex items-center gap-2 text-[10px] text-slate-300 font-bold">
              <svg width="26" height="8">
                <line x1="0" y1="4" x2="26" y2="4" stroke={f.color} strokeWidth="2.5" strokeDasharray={DASHES[f.id % DASHES.length]} />
              </svg>
              {shortName(f.name, f.id)}
              <span className="text-slate-500 font-normal">({f.archetype.toLowerCase()})</span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METRICS.map(m => (
            <LineChart key={m.key} title={m.title} sols={sols} series={chartFor(m.key)} />
          ))}
        </div>

        <p className="text-[9px] text-slate-600 mt-4 leading-relaxed">
          Watch the strategies diverge: traders spike credits, racers trade early stability for reach,
          agrarians climb the population chart. Upgrade modules (⚡ ♻️ 🎲) bend these curves further.
        </p>
      </div>
    </div>
  );
};

export default DashboardPanel;
