// src/index.js
// FLUQ Alpha 1.0 - ES module main runner
//
// Requirements:
//  - Node.js 16+ (preferably Node 18+ or 20+). Ensure package.json contains: "type": "module"
//  - All imported files must be ES modules (use `export` in those files).
//
// Flow:
//  1) Collect randomness from collectors (mouse, keyboard, cpu, crypto)
//  2) Build E_i (512-bit) and secret s_i
//  3) Commit = H(E_i || s_i || round_id)
//  4) Reveal locally and verify commit
//  5) Mix reveals -> R_round
//  6) Cheat detection
//  7) Uniqueness scoring
//  8) Reward allocation
//  9) Print/save round record

import crypto from 'crypto';

// Collectors (must export an async `collect()` function that returns Buffer or hex string)
import * as mouseCollector from './collectors/mouseCollector.js';
import * as keyboardCollector from './collectors/keyboardCollector.js';
import * as cpuCollector from './collectors/cpuNoiseCollector.js';
import * as cryptoCollector from './collectors/cryptoCollector.js';

// Modules (each should export the named functions used below)
import * as mixer from './mixer/mixRandomness.js';
import * as cheatDetector from './detector/cheatDetector.js';
import * as uniquenessScore from './scoring/uniquenessScore.js';
import * as rewardEngine from './token/rewardEngine.js';

// Utils (hash.js should export sha256/sha512; logger.js should export info/warn/error)
import * as hashUtils from './utils/hash.js';
import * as logger from './utils/logger.js';

/** Normalize any returned collector value into a Buffer */
function normalizeToBuffer(x) {
  if (!x) return crypto.randomBytes(32);
  if (Buffer.isBuffer(x)) return x;
  if (typeof x === 'string') {
    // assume hex (strip 0x if present)
    const s = x.replace(/^0x/, '');
    // if string length odd or not hex, fallback
    if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) return Buffer.from(s, 'utf8');
    return Buffer.from(s, 'hex');
  }
  if (typeof x === 'object' && typeof x.hex === 'string') {
    return Buffer.from(x.hex.replace(/^0x/, ''), 'hex');
  }
  // fallback to random
  return crypto.randomBytes(32);
}

async function safeCollect(moduleNamespace, name) {
  if (!moduleNamespace || typeof moduleNamespace.collect !== 'function') {
    logger.warn(`${name}: collect() not found — returning fallback random bytes.`);
    return crypto.randomBytes(32);
  }
  try {
    const out = await moduleNamespace.collect();
    return normalizeToBuffer(out);
  } catch (err) {
    logger.error(`${name}: collect() threw — using fallback.`, err?.message ?? err);
    return crypto.randomBytes(32);
  }
}

function bufferToHex(buf) {
  if (!buf) return '';
  if (Buffer.isBuffer(buf)) return buf.toString('hex');
  return String(buf);
}

async function runRound() {
  logger.info('--- FLUQ Alpha 1.0: Starting round ---');

  // metadata
  const roundId = `round-${Date.now()}`;
  const prevRoundHash = process.env.PREV_ROUND_HASH || '0'.repeat(64);

  logger.info(`Round ID: ${roundId}`);
  logger.info(`Prev round hash: ${prevRoundHash}`);

  // Collect entropy concurrently
  logger.info('Collecting entropy from collectors (mouse, keyboard, cpu, crypto)...');
  const [mouseBuf, keyboardBuf, cpuBuf, cryptoBuf] = await Promise.all([
    safeCollect(mouseCollector, 'mouseCollector'),
    safeCollect(keyboardCollector, 'keyboardCollector'),
    safeCollect(cpuCollector, 'cpuNoiseCollector'),
    safeCollect(cryptoCollector, 'cryptoCollector'),
  ]);

  // Convert to hex strings for deterministic concatenation
  const collected = {
    mouse: bufferToHex(mouseBuf).padEnd(64, '0').slice(0, 64),      // normalize length to avoid empty concat surprises
    keyboard: bufferToHex(keyboardBuf).padEnd(64, '0').slice(0, 64),
    cpu: bufferToHex(cpuBuf).padEnd(64, '0').slice(0, 64),
    crypto: bufferToHex(cryptoBuf).padEnd(64, '0').slice(0, 64),
  };

  logger.info('Collected pieces:', Object.keys(collected).map(k => `${k}:${collected[k].slice(0,10)}...`).join(' | '));

  // Build E_i: deterministic ordered concat then sha512 to produce fixed 512-bit hex string
  const piecesOrdered = ['mouse', 'keyboard', 'cpu', 'crypto'];
  const concatenatedHex = piecesOrdered.map(k => collected[k]).join('');
  const E_i = hashUtils.sha512(concatenatedHex); // hex string (128 hex chars for 512 bits)
  logger.info(`E_i (512-bit hex prefix): ${E_i.slice(0,24)}...`);

  // Local secret s_i
  const s_i = crypto.randomBytes(32).toString('hex'); // 256-bit hex
  logger.info(`s_i (secret) prefix: ${s_i.slice(0,12)}...`);

  // Commit: sha256(E_i || s_i || roundId)
  const commitInput = E_i + s_i + roundId;
  const commit = hashUtils.sha256(commitInput);
  logger.info(`Commit (sha256): ${commit}`);

  // Reveal locally (simulate): verify commit
  const recomputed = hashUtils.sha256(E_i + s_i + roundId);
  if (recomputed !== commit) {
    logger.error('Local commit verification failed; aborting.');
    return;
  }
  logger.info('Commit verified locally.');

  // Build reveals array (single-node prototype)
  const reveals = [{
    node_id: 'local-node-0',
    round_id: roundId,
    E_i,
    s_i,
    commit
  }];

  // Mixer: pass array of E_i values and metadata; mixer returns hex seed (e.g., sha256)
  const E_list = reveals.map(r => r.E_i);
  const mixInputArray = [prevRoundHash, roundId, ...E_list];
  const roundSeed = mixer.mixRandomness(mixInputArray); // expect hex string
  logger.info(`R_round (final seed) prefix: ${roundSeed.slice(0,16)}...`);

  // Cheat detection
  const cheatResult = (typeof cheatDetector.check === 'function') ? cheatDetector.check(reveals) : (typeof cheatDetector.default === 'function' ? cheatDetector.default(reveals) : { cheated: false });
  if (cheatResult && cheatResult.cheated) {
    logger.warn('Cheating detected:', cheatResult.reason);
  } else {
    logger.info('No cheating detected.');
  }

  // Uniqueness scoring
  const scoreResult = (typeof uniquenessScore.evaluate === 'function') ? uniquenessScore.evaluate(E_list) : (typeof uniquenessScore.default === 'function' ? uniquenessScore.default(E_list) : { score: 50, category: 'Unknown' });
  logger.info(`Uniqueness score: ${scoreResult.score} (${scoreResult.category})`);

  // Reward allocation
  const tokensAwarded = (typeof rewardEngine.allocate === 'function') ? rewardEngine.allocate(scoreResult.score) : (typeof rewardEngine.default === 'function' ? rewardEngine.default(scoreResult.score) : 0);
  logger.info(`Tokens awarded this round: ${tokensAwarded} FLQ`);

  // Construct round record (for rolling log)
  const record = {
    round_id: roundId,
    prev_root_hash: prevRoundHash,
    timestamp: new Date().toISOString(),
    reveals: reveals.map(r => ({ node_id: r.node_id, commit: r.commit })),
    R_round: roundSeed,
    awarded: tokensAwarded
  };

  logger.info('Round record:', JSON.stringify(record, null, 2));
  logger.info('--- FLUQ Alpha 1.0: Round complete ---');

  return record;
}

// Run the round when file executed
if (import.meta.url === `file://${process.cwd()}/src/index.js` || import.meta.url.endsWith('/src/index.js')) {
  runRound().catch(err => {
    logger.error('Fatal error in runRound:', err?.stack ?? err);
    process.exit(1);
  });
}

// Export runRound for tests / external runners
export { runRound };
