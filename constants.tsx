
import React from 'react';
import { ResourceType } from './types';

export const HEX_RADIUS = 60;
export const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
export const HEX_HEIGHT = 2 * HEX_RADIUS;

export const RESOURCE_STYLES: Record<ResourceType, { color: string; bg: string; icon: string }> = {
  [ResourceType.REGOLITH]: { color: '#64748b', bg: 'bg-slate-500', icon: '🌑' },
  [ResourceType.ICE]: { color: '#0ea5e9', bg: 'bg-sky-500', icon: '❄️' },
  [ResourceType.HE3]: { color: '#8b5cf6', bg: 'bg-violet-500', icon: '⚡' },
  [ResourceType.SILICATES]: { color: '#f59e0b', bg: 'bg-amber-500', icon: '💎' },
  [ResourceType.ORES]: { color: '#ef4444', bg: 'bg-red-500', icon: '🌋' },
  [ResourceType.DESERT]: { color: '#1e293b', bg: 'bg-slate-800', icon: '💀' },
};

export const INITIAL_RESOURCES = {
  [ResourceType.REGOLITH]: 2,
  [ResourceType.ICE]: 2,
  [ResourceType.HE3]: 0,
  [ResourceType.SILICATES]: 1,
  [ResourceType.ORES]: 1,
  [ResourceType.DESERT]: 0,
};
