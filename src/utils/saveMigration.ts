import type { GameState } from '../types';
import { generateInitialState } from '../data/events/helpers';
import { setGameSeed } from './random';

export const CURRENT_SAVE_VERSION = 2;

export interface RawSaveEnvelope {
  version?: number;
  savedAt?: number;
  gameState?: Partial<GameState>;
  currentEventId?: string;
  hasUnlockedShopToast?: boolean;
  hasOpenedShop?: boolean;
  [key: string]: unknown;
}

export interface MigratedSaveResult {
  gameState: GameState;
  currentEventId: string;
  hasUnlockedShopToast: boolean;
  hasOpenedShop: boolean;
  migratedFromVersion?: number;
}

/**
 * Validates, repairs, and migrates raw save data across schema versions.
 * Guarantees a fully typed, valid GameState with non-null arrays and safe numeric bounds.
 */
export function migrateSaveData(raw: unknown): MigratedSaveResult {
  const fallbackState = generateInitialState();
  const fallbackResult: MigratedSaveResult = {
    gameState: fallbackState,
    currentEventId: 'choose_trait',
    hasUnlockedShopToast: false,
    hasOpenedShop: false,
  };

  if (!raw || typeof raw !== 'object') {
    return fallbackResult;
  }

  const envelope = raw as RawSaveEnvelope;
  const rawState = (envelope.gameState || {}) as Partial<GameState>;
  const saveVersion = envelope.version || 0;

  // 1. Numeric & Field Polyfills for legacy v0/v1 saves
  const sanitizedCash = typeof rawState.cash === 'number' && !isNaN(rawState.cash) ? rawState.cash : fallbackState.cash;
  const sanitizedStocks = typeof rawState.stocks === 'number' && !isNaN(rawState.stocks) ? rawState.stocks : 0;
  const sanitizedHealth = typeof rawState.health === 'number' && !isNaN(rawState.health) ? Math.max(0, Math.min(100, rawState.health)) : 80;
  const sanitizedLeetcode = typeof rawState.leetcode === 'number' && !isNaN(rawState.leetcode) ? Math.max(0, Math.min(100, rawState.leetcode)) : 0;
  const sanitizedCharm = typeof rawState.charm === 'number' && !isNaN(rawState.charm) ? Math.max(0, Math.min(rawState.max_charm || 25, rawState.charm)) : 10;
  const sanitizedNetwork = typeof rawState.network === 'number' && !isNaN(rawState.network) ? Math.max(0, Math.min(100, rawState.network)) : 10;
  const sanitizedTC = typeof rawState.tc === 'number' && !isNaN(rawState.tc) ? rawState.tc : 0;
  const sanitizedAge = typeof rawState.age === 'number' && !isNaN(rawState.age) ? rawState.age : 18;
  const sanitizedYear = typeof rawState.year === 'number' && !isNaN(rawState.year) ? rawState.year : 2018;
  const sanitizedWinThreshold = typeof rawState.win_threshold === 'number' && !isNaN(rawState.win_threshold) ? rawState.win_threshold : 500;

  // 2. Structured Collections Polyfills
  const sanitizedTimeline = Array.isArray(rawState.timeline) ? rawState.timeline : [];
  const sanitizedHistory = Array.isArray(rawState.history_net_worth) && rawState.history_net_worth.length > 0
    ? rawState.history_net_worth
    : [{ age: sanitizedAge, year: sanitizedYear, netWorth: sanitizedCash + sanitizedStocks, cash: sanitizedCash, stocks: sanitizedStocks }];
  const sanitizedStoryFlags = rawState.story_flags && typeof rawState.story_flags === 'object' ? rawState.story_flags : {};
  const sanitizedNPCs = rawState.npcs && typeof rawState.npcs === 'object' ? rawState.npcs : {};
  const sanitizedSeed = typeof rawState.seed === 'number' ? rawState.seed : Math.floor(Math.random() * 2147483647);

  // Sync PRNG with save seed
  setGameSeed(sanitizedSeed);

  const migratedState: GameState = {
    ...fallbackState,
    ...rawState,
    age: sanitizedAge,
    year: sanitizedYear,
    cash: parseFloat(sanitizedCash.toFixed(2)),
    stocks: parseFloat(sanitizedStocks.toFixed(2)),
    health: sanitizedHealth,
    leetcode: sanitizedLeetcode,
    charm: sanitizedCharm,
    network: sanitizedNetwork,
    tc: (rawState.laid_off || rawState.job_type === 'unemployed') ? 0 : parseFloat(sanitizedTC.toFixed(2)),
    win_threshold: sanitizedWinThreshold,
    timeline: sanitizedTimeline,
    history_net_worth: sanitizedHistory,
    story_flags: sanitizedStoryFlags,
    npcs: sanitizedNPCs,
    seed: sanitizedSeed,
  };

  const currentEventId = typeof envelope.currentEventId === 'string' ? envelope.currentEventId : 'choose_trait';

  return {
    gameState: migratedState,
    currentEventId,
    hasUnlockedShopToast: Boolean(envelope.hasUnlockedShopToast),
    hasOpenedShop: Boolean(envelope.hasOpenedShop),
    migratedFromVersion: saveVersion < CURRENT_SAVE_VERSION ? saveVersion : undefined,
  };
}
