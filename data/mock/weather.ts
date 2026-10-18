import type { Weather } from '@/types';

export const WEATHER_CONDITIONS: Weather[] = [
  { icon: '☀️', temp: 32, description: 'Sunny and hot', humidity: 55, rainChance: 10 },
  { icon: '⛅', temp: 28, description: 'Partly cloudy', humidity: 72, rainChance: 40 },
  { icon: '🌦️', temp: 26, description: 'Light rain expected', humidity: 80, rainChance: 70 },
  { icon: '⛈️', temp: 24, description: 'Thunderstorms', humidity: 88, rainChance: 90 },
];
