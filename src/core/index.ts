import type { BasemapStyle } from 'places-shared/map';

export const RADAR_STYLES: ReadonlyArray<BasemapStyle & { settingsName: string }> = [
  { value: 'radar-default-v1', name: 'Default', settingsName: 'Radar Default' },
  { value: 'radar-light-v1', name: 'Light', settingsName: 'Radar Light' },
  { value: 'radar-dark-v1', name: 'Dark', settingsName: 'Radar Dark' },
  { value: 'radar-satellite-v1', name: 'Satellite', settingsName: 'Satellite (Enterprise plan)' },
  { value: 'radar-hybrid-v1', name: 'Hybrid', settingsName: 'Hybrid (Enterprise plan)' },
];

export function radarStyleUrl(styleId: string, apiKey: string): string {
  return `https://api.radar.io/maps/styles/${styleId}?publishableKey=${apiKey}`;
}
