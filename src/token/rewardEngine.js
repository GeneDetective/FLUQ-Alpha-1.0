// src/token/rewardEngine.js
// ESM version for FLUQ Alpha 1.0
// Provides token reward logic and an immutable-style balance updater.
// Usage (import):
//   import { computeReward, awardTokensToBalance } from './rewardEngine.js';
// Usage (CLI):
//   node src/token/rewardEngine.js <score> [minerId]
//
// Node: requires Node 14+ (for ESM). package.json should contain: "type": "module"

import { fileURLToPath } from 'url';
import path from 'path';

'use strict';

/**
 * Compute token reward given a uniqueness score (0-100).
 *
 * Rules:
 *   score > 80  -> 5 FLUQ tokens
 *   50 <= score <= 80 -> 3 FLUQ tokens
 *   score < 50  -> 1 FLUQ token
 *
 * Returns an object describing the award.
 *
 * @param {number} score - Uniqueness score (0..100).
 * @returns {{ score: number, tokens: number, category: string, reason: string }}
 */
export function computeReward(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new TypeError('computeReward: score must be a valid number');
  }

  // Clamp to [0,100]
  const s = Math.max(0, Math.min(100, Math.round(score)));

  let tokens;
  let category;
  let reason;

  if (s > 80) {
    tokens = 5;
    category = 'High Entropy';
    reason = 'Score above 80: highest reward bracket';
  } else if (s >= 50) {
    tokens = 3;
    category = 'Medium Entropy';
    reason = 'Score between 50 and 80: medium reward bracket';
  } else {
    tokens = 1;
    category = 'Low Entropy';
    reason = 'Score below 50: baseline reward';
  }

  return {
    score: s,
    tokens,
    category,
    reason
  };
}

/**
 * Award tokens to a miner in an in-memory balances object (immutable-style).
 * Does NOT persist to disk. Returns a new balances object with the miner's balance updated.
 *
 * @param {string} minerId - unique id for miner
 * @param {Record<string, number>} balances - existing balances { minerId: number, ... }
 * @param {number} score - uniqueness score (0..100)
 * @returns {{ updatedBalances: Record<string, number>, awarded: number, meta: object }}
 */
export function awardTokensToBalance(minerId, balances = {}, score) {
  if (typeof minerId !== 'string' || minerId.length === 0) {
    throw new TypeError('awardTokensToBalance: minerId must be a non-empty string');
  }

  if (typeof balances !== 'object' || balances === null) {
    throw new TypeError('awardTokensToBalance: balances must be an object (or omitted)');
  }

  const result = computeReward(score);
  const awarded = result.tokens;

  // clone balances to avoid mutating input (immutable style)
  const updatedBalances = Object.assign({}, balances);

  const prev = Number(updatedBalances[minerId] || 0);
  updatedBalances[minerId] = prev + awarded;

  return {
    updatedBalances,
    awarded,
    meta: result
  };
}

/**
 * Convenience helper: pretty-print function for CLI output.
 * @param {object} obj
 */
function prettyPrint(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

/* ----------------- CLI Entrypoint  ----------------- */
/**
 * When this module is executed directly (node src/token/rewardEngine.js ...),
 * parse argv and run a simple demo: compute reward, optionally update a balances object.
 */
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  // CLI mode
  (async () => {
    try {
      const argv = process.argv.slice(2);
      if (argv.length === 0) {
        console.log('Usage: node src/token/rewardEngine.js <score> [minerId]');
        console.log('Example: node src/token/rewardEngine.js 87 miner1');
        process.exit(0);
      }

      const scoreRaw = argv[0];
      const minerId = argv[1] || 'test-miner';

      const score = Number(scoreRaw);
      if (Number.isNaN(score)) {
        console.error('Invalid score. Please provide a numeric score (0..100).');
        process.exit(2);
      }

      const reward = computeReward(score);
      console.log('Computed reward:');
      prettyPrint(reward);

      // Example: award to an in-memory balances object
      const initialBalances = {};
      const { updatedBalances, awarded, meta } = awardTokensToBalance(minerId, initialBalances, score);
      console.log(`\nAwarded ${awarded} FLUQ token(s) to miner '${minerId}'.`);
      console.log('Updated balances (example):');
      prettyPrint(updatedBalances);
      console.log('Meta:', meta);

      process.exit(0);
    } catch (err) {
      console.error('Error (rewardEngine CLI):', err?.message ?? err);
      process.exit(1);
    }
  })();
}

/* ----------------- End of file ----------------- */
