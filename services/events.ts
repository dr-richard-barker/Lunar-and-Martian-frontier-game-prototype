import { ColonyEvent, ResourceKind } from '../types';

/**
 * Local event tables — replaces the old Gemini API calls so the game
 * runs fully offline with no API key.
 */

const EVENTS: ColonyEvent[] = [
  {
    title: 'Solar Flare',
    description: 'A coronal mass ejection washes over the surface. Sensitive electronics are scrambled and crews shelter in place.',
    effect: 'Production halts cost you stockpiled oxygen and water.',
    impact: { [ResourceKind.OXYGEN]: -4, [ResourceKind.WATER]: -3 },
  },
  {
    title: 'Micrometeorite Shower',
    description: 'A stream of high-velocity debris peppers the colony. Repair drones patch punctures through the night.',
    effect: 'Emergency repairs consume metal.',
    impact: { [ResourceKind.METAL]: -8 },
  },
  {
    title: 'Dust Storm Static',
    description: 'Electrostatically charged dust clings to every panel and antenna. Cleaning crews work double shifts.',
    effect: 'Maintenance costs drain credits.',
    impact: { [ResourceKind.CREDITS]: -40 },
  },
  {
    title: 'Supply Capsule Landing',
    description: 'An unscheduled resupply capsule from Earth touches down on target. The manifest is a welcome surprise.',
    effect: 'Bonus food and water delivered.',
    impact: { [ResourceKind.FOOD]: 10, [ResourceKind.WATER]: 8 },
  },
  {
    title: 'Mineral Windfall',
    description: 'Excavators break into an unusually rich pocket of ore. The refinery runs hot for a full sol.',
    effect: 'Bonus metal extracted.',
    impact: { [ResourceKind.METAL]: 12 },
  },
  {
    title: 'Earth Media Deal',
    description: 'A terrestrial network licenses your colony feeds for a documentary. Fame pays, briefly.',
    effect: 'Licensing windfall in credits.',
    impact: { [ResourceKind.CREDITS]: 90 },
  },
  {
    title: 'Ice Fissure Discovered',
    description: 'Seismic scans reveal a shallow fissure of nearly pure water ice within crawler range.',
    effect: 'Easy pickings: bonus water.',
    impact: { [ResourceKind.WATER]: 10 },
  },
  {
    title: 'Airlock Malfunction',
    description: 'A stuck airlock cycles open for eleven seconds too long. Reserves are vented before the override kicks in.',
    effect: 'Oxygen reserves vented.',
    impact: { [ResourceKind.OXYGEN]: -6 },
  },
  {
    title: 'Fungal Bloom',
    description: 'An experimental culture in the greenhouse blooms far beyond projections. The kitchens improvise.',
    effect: 'Bonus food harvested.',
    impact: { [ResourceKind.FOOD]: 8 },
  },
  {
    title: 'Comms Blackout',
    description: 'Atmospheric interference cuts the uplink to Earth. Automated trading orders fail to execute.',
    effect: 'Missed trades cost credits.',
    impact: { [ResourceKind.CREDITS]: -25 },
  },
];

const LORE: string[] = [
  'The stars are cold, but our resolve is steel. Keep drilling.',
  'Dust gets into everything out here — suits, filters, dreams. We dig anyway.',
  'Earthrise this morning. Nobody said a word for ten minutes. Back to work.',
  'Ration report is green. Barely. The greenhouse crew are heroes in my log.',
  'Another sol, another meter of regolith between us and the void.',
  'The reactor hums like a heartbeat. As long as it hums, we live.',
  'Sent my kid a photo of the crater rim. She says it looks like home. It is.',
  'Water is life. Ice is hope frozen solid. Extract both.',
  'The silence outside is absolute. Inside, the colony sings with machinery.',
  'Command asked for projections. I sent them a picture of our first tomato.',
  'Radiation badge is still yellow. Good enough for one more surface walk.',
  'We name the drills like ships. Lost "Persistence" today. "Stubborn" digs on.',
];

let loreIndex = Math.floor(Math.random() * LORE.length);

/** Returns a random colony event drawn from the local event table. */
export function rollEvent(): ColonyEvent {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

/** Returns the next commander transmission, cycling through the local lore table. */
export function nextLore(): string {
  loreIndex = (loreIndex + 1 + Math.floor(Math.random() * 3)) % LORE.length;
  return LORE[loreIndex];
}
