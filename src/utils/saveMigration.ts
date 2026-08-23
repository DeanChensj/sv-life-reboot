import type { GameState } from '../types';
import { generateInitialState } from '../data/events/helpers';
import { setGameSeed } from './random';
import { VISA_STATUS } from '../constants/gameConstants';

export const CURRENT_SAVE_VERSION = 2;

export interface RawSaveEnvelope {
  version?: number;
  savedAt?: number;
  gameState?: Partial<GameState>;
  currentEventId?: string;
  hasUnlockedShopToast?: boolean;
  hasSeenBuyHouseToast?: boolean;
  hasOpenedShop?: boolean;
  [key: string]: unknown;
}

export interface MigratedSaveResult {
  gameState: GameState;
  currentEventId: string;
  hasUnlockedShopToast: boolean;
  hasSeenBuyHouseToast: boolean;
  hasOpenedShop: boolean;
  migratedFromVersion?: number;
}

const VALID_VISAS: ReadonlySet<string> = new Set(Object.values(VISA_STATUS));

/**
 * Per-version migration ladder.
 *
 * Each step takes the raw state exactly as persisted at version N and returns it
 * shaped for version N+1. The steps are additive today (new fields are optional
 * and backfilled by the sanitizer below), but this ladder is the ONLY correct
 * seam for a real schema break — renaming a field, changing a unit, or splitting
 * one field into two. When such a break lands, implement it here keyed on the
 * source version; never rely on the blanket `...rawState` spread to carry stale
 * data across a breaking change.
 */
function migrateV0ToV1(state: Partial<GameState>): Partial<GameState> {
  // v0 predates explicit `stocks`/`seed`/`story_flags`. These are optional and
  // reconstructed by the sanitizer, so no structural transform is needed yet.
  return state;
}

function migrateV1ToV2(state: Partial<GameState>): Partial<GameState> {
  // v1 → v2 introduced rental/passive-income and timeline fields, all optional
  // and additive; the sanitizer backfills them. No rename to handle yet.
  return state;
}

function runMigrationLadder(state: Partial<GameState>, fromVersion: number): Partial<GameState> {
  let s = state;
  if (fromVersion < 1) s = migrateV0ToV1(s);
  if (fromVersion < 2) s = migrateV1ToV2(s);
  return s;
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
    hasSeenBuyHouseToast: false,
    hasOpenedShop: false,
  };

  if (!raw || typeof raw !== 'object') {
    return fallbackResult;
  }

  const envelope = raw as RawSaveEnvelope;
  const saveVersion = envelope.version || 0;

  // 0. Run the versioned migration ladder BEFORE sanitizing, so that any real
  //    schema transform is applied while the source version is still known.
  const rawState = runMigrationLadder((envelope.gameState || {}) as Partial<GameState>, saveVersion);

  // 1. Numeric & Field Polyfills for legacy v0/v1 saves
  const sanitizedCash = typeof rawState.cash === 'number' && !isNaN(rawState.cash) ? rawState.cash : fallbackState.cash;
  const sanitizedStocks = typeof rawState.stocks === 'number' && !isNaN(rawState.stocks) ? rawState.stocks : 0;
  const sanitizedHealth = typeof rawState.health === 'number' && !isNaN(rawState.health) ? Math.max(0, Math.min(100, rawState.health)) : fallbackState.health;
  const sanitizedLeetcode = typeof rawState.leetcode === 'number' && !isNaN(rawState.leetcode) ? Math.max(0, Math.min(100, rawState.leetcode)) : 0;
  // max_charm must be sanitized FIRST so it can safely serve as the charm ceiling.
  const sanitizedMaxCharm = typeof rawState.max_charm === 'number' && !isNaN(rawState.max_charm) ? Math.max(15, Math.min(30, rawState.max_charm)) : (fallbackState.max_charm || 25);
  const sanitizedCharm = typeof rawState.charm === 'number' && !isNaN(rawState.charm) ? Math.max(1, Math.min(sanitizedMaxCharm, rawState.charm)) : 10;
  const sanitizedNetwork = typeof rawState.network === 'number' && !isNaN(rawState.network) ? Math.max(0, Math.min(100, rawState.network)) : 10;
  const sanitizedTC = typeof rawState.tc === 'number' && !isNaN(rawState.tc) ? rawState.tc : 0;
  const sanitizedAge = typeof rawState.age === 'number' && !isNaN(rawState.age) ? rawState.age : 18;
  const sanitizedYear = typeof rawState.year === 'number' && !isNaN(rawState.year) ? rawState.year : 2018;
  const sanitizedWinThreshold = typeof rawState.win_threshold === 'number' && !isNaN(rawState.win_threshold) ? rawState.win_threshold : 500;
  const sanitizedLuck = typeof rawState.luck === 'number' && !isNaN(rawState.luck) ? Math.max(0, Math.min(100, rawState.luck)) : fallbackState.luck;
  const sanitizedRent = typeof rawState.rent === 'number' && !isNaN(rawState.rent) ? Math.max(0, rawState.rent) : fallbackState.rent;
  const sanitizedGcProgress = typeof rawState.gc_progress === 'number' && !isNaN(rawState.gc_progress) ? Math.max(0, Math.min(5, rawState.gc_progress)) : fallbackState.gc_progress;
  const sanitizedVisa = typeof rawState.visa === 'string' && VALID_VISAS.has(rawState.visa) ? rawState.visa : fallbackState.visa;

  // 2. Structured Collections Polyfills
  const sanitizedTimeline = Array.isArray(rawState.timeline) ? rawState.timeline : [];
  const sanitizedHistory = Array.isArray(rawState.history_net_worth) && rawState.history_net_worth.length > 0
    ? rawState.history_net_worth
    : [{ age: sanitizedAge, year: sanitizedYear, netWorth: sanitizedCash + sanitizedStocks, cash: sanitizedCash, stocks: sanitizedStocks }];
  const sanitizedStoryFlags = rawState.story_flags && typeof rawState.story_flags === 'object' ? rawState.story_flags : {};
  const sanitizedNPCs = rawState.npcs && typeof rawState.npcs === 'object' ? rawState.npcs : {};

  // 100% idempotent seed generation for legacy unseeded saves
  const sanitizedSeed = typeof rawState.seed === 'number' && !isNaN(rawState.seed)
    ? (rawState.seed >>> 0)
    : (((sanitizedYear * 10007) ^ (sanitizedAge * 997) ^ Math.round(sanitizedCash * 100) ^ Math.round(sanitizedStocks * 100)) >>> 0);

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
    max_charm: sanitizedMaxCharm,
    network: sanitizedNetwork,
    tc: (rawState.laid_off || rawState.job_type === 'unemployed') ? 0 : parseFloat(sanitizedTC.toFixed(2)),
    win_threshold: sanitizedWinThreshold,
    luck: sanitizedLuck,
    rent: sanitizedRent,
    gc_progress: sanitizedGcProgress,
    visa: sanitizedVisa,
    // `message` is a required string; a save carrying `message: undefined` would otherwise
    // survive the ...rawState spread and violate the type. Re-assert it.
    message: typeof rawState.message === 'string' ? rawState.message : fallbackState.message,
    // Coerce persisted booleans (undefined falls back to the fresh-game default).
    has_us_degree: Boolean(rawState.has_us_degree ?? fallbackState.has_us_degree),
    is_phd: Boolean(rawState.is_phd ?? fallbackState.is_phd),
    is_married: Boolean(rawState.is_married ?? fallbackState.is_married),
    has_pet: Boolean(rawState.has_pet ?? fallbackState.has_pet),
    laid_off: Boolean(rawState.laid_off ?? fallbackState.laid_off),
    has_housing: Boolean(rawState.has_housing ?? fallbackState.has_housing),
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
    hasSeenBuyHouseToast: Boolean(envelope.hasSeenBuyHouseToast),
    hasOpenedShop: Boolean(envelope.hasOpenedShop),
    migratedFromVersion: saveVersion < CURRENT_SAVE_VERSION ? saveVersion : undefined,
  };
}
