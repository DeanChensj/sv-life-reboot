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

let activePRNG = createPRNG(currentSeed);

/**
 * Sets the global seed for reproducible game runs, fuzzing, and Monte Carlo tests.
 */
export function setGameSeed(seed: number | string): number {
  const numericSeed = typeof seed === 'string'
    ? hashStringToSeed(seed)
    : (seed >>> 0);
  currentSeed = numericSeed;
  activePRNG = createPRNG(currentSeed);
  return currentSeed;
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
  return activePRNG();
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
