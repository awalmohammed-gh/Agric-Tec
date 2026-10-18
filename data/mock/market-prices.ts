import type { MarketPrice } from '@/types';

export const MARKET_PRICES: MarketPrice[] = [
  { crop: 'Maize', emoji: '🌽', unit: '100kg bag', price: 320, change: 5.2 },
  { crop: 'Cassava', emoji: '🍠', unit: '100kg', price: 90, change: -1.5 },
  { crop: 'Rice (local)', emoji: '🍚', unit: '50kg bag', price: 550, change: 8.1 },
  { crop: 'Cocoa', emoji: '🍫', unit: '64kg bag', price: 1350, change: 3.4 },
  { crop: 'Yam', emoji: '🥔', unit: 'tuber', price: 45, change: -2.0 },
  { crop: 'Plantain', emoji: '🍌', unit: 'bunch', price: 25, change: 1.8 },
  { crop: 'Groundnut', emoji: '🥜', unit: '50kg bag', price: 600, change: 4.5 },
  { crop: 'Tomato', emoji: '🍅', unit: 'basket', price: 180, change: -6.2 },
];
