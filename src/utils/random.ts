// Mulberry32: Fast, high-quality 32-bit seedable pseudo-random number generator

let currentSeed: number = Math.floor(Math.random() * 2147483647);

/**
 * Creates a deterministic PRNG function from an integer seed.
 * Returns a function that outputs floating point numbers in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function mulberry32(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The GLOBAL generator keeps its mulberry32 state in a module variable (rather than hidden in
// a closure) so it can be snapshotted into the save file and restored on load. Without that,
// every reload rewound the stream to offset 0: the same upcoming rolls could be replayed by
// save-scumming, and the "deterministic run" contract was false.
let prngState: number = currentSeed >>> 0;

/** Advances the global mulberry32 stream by one step. */
function stepGlobal(): number {
  prngState = (prngState + 0x6D2B79F5) >>> 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Sets the global seed for reproducible game runs, fuzzing, and Monte Carlo tests.
 */
export function setGameSeed(seed: number | string): number {
  const numericSeed = typeof seed === 'string'
    ? hashStringToSeed(seed)
    : (seed >>> 0);
  currentSeed = numericSeed;
  prngState = numericSeed >>> 0;
  return currentSeed;
}

/**
 * Snapshot of how far the global stream has advanced. Persist alongside the seed so a reload
 * resumes the stream instead of restarting it.
 */
export function getPRNGState(): number {
  return prngState >>> 0;
}

/** Restores a stream position captured by getPRNGState(). */
export function setPRNGState(state: number): void {
  if (typeof state === 'number' && !isNaN(state)) {
    prngState = state >>> 0;
  }
}

/**
 * Gets the current active game seed.
 */
export function getGameSeed(): number {
  return currentSeed;
}

/**
 * Primary random function for game mechanics.
 * Can be seeded for 100% deterministic replays.
 */
export function gameRandom(): number {
  return stepGlobal();
}

/**
 * Generates a random integer in [min, max] inclusive.
 */
export function gameRandomInt(min: number, max: number): number {
  return Math.floor(gameRandom() * (max - min + 1)) + min;
}

/**
 * Randomly picks one element from an array using gameRandom.
 */
export function gamePick<T>(array: readonly T[]): T {
  const index = Math.floor(gameRandom() * array.length);
  return array[index];
}

/**
 * Simple djb2-like string hasher to convert any string seed to a 32-bit integer.
 */
function hashStringToSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}
