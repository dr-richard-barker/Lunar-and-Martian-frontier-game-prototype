/**
 * Procedural sound effects — synthesized with WebAudio at runtime, so the
 * game ships zero audio assets and stays fully offline.
 */

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('lf-muted') === '1';
} catch { /* ignore */ }

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('lf-muted', m ? '1' : '0');
  } catch { /* ignore */ }
}

/** Must be called from a user gesture before sounds can play. */
export function unlock(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** Multiply frequency by this over the note's duration (pitch slide). */
  slide?: number;
}

function tone(freq: number, dur: number, opts: ToneOpts = {}): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  const { type = 'sine', gain = 0.06, delay = 0, slide } = opts;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, gain = 0.05, delay = 0): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  /** Selecting a tile / minor UI action. */
  click(): void {
    tone(760, 0.05, { type: 'triangle', gain: 0.04 });
  },
  /** Order placed (construction or city production). */
  place(): void {
    tone(392, 0.08, { type: 'triangle', gain: 0.05 });
    tone(587, 0.1, { type: 'triangle', gain: 0.05, delay: 0.07 });
  },
  /** Construction completed — small rising chime. */
  complete(): void {
    tone(523, 0.11, { gain: 0.05 });
    tone(659, 0.11, { gain: 0.05, delay: 0.09 });
    tone(784, 0.22, { gain: 0.055, delay: 0.18 });
  },
  /** Colonist / rover arrival. */
  arrive(): void {
    tone(587, 0.09, { gain: 0.045 });
    tone(880, 0.14, { gain: 0.045, delay: 0.08 });
  },
  /** Colony event alarm. */
  alert(): void {
    tone(311, 0.22, { type: 'sawtooth', gain: 0.045 });
    tone(233, 0.3, { type: 'sawtooth', gain: 0.045, delay: 0.22 });
  },
  /** Demolition / cancellation. */
  demolish(): void {
    noise(0.22, 0.06);
    tone(180, 0.18, { type: 'square', gain: 0.03, slide: 0.55 });
  },
  /** Something went badly wrong (colonist lost). */
  loss(): void {
    tone(392, 0.16, { gain: 0.04, slide: 0.75 });
    tone(294, 0.24, { gain: 0.04, delay: 0.14, slide: 0.8 });
  },
};
