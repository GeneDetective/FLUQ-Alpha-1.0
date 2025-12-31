// src/scoring/uniquenessScore.js (ESM)
//
// Purpose:
// - Compute a 0–100 uniqueness/entropy score for a set of randomness inputs.
// - Returns { score, category, breakdown } where breakdown shows sub-scores.
// - No external dependencies (Node.js built-in only).
//
// This is a direct ESM conversion of your original module.

import crypto from 'crypto'; // kept for parity (unused in core functions)

/* -------------------- Helpers -------------------- */

function toBuffer(x) {
  if (Buffer.isBuffer(x)) return x;
  if (typeof x === 'string') return Buffer.from(x, 'utf8');
  if (Array.isArray(x)) return Buffer.from(x);
  throw new TypeError('Input must be Buffer, string, or byte array');
}

function concatBuffers(arr) {
  const buffers = arr.map(toBuffer);
  return Buffer.concat(buffers);
}

// Shannon entropy in bits per byte (0..8). Returns bits of entropy.
function shannonEntropyBits(buf) {
  if (!buf || buf.length === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
  let ent = 0;
  const len = buf.length;
  for (let i = 0; i < 256; i++) {
    const f = freq[i];
    if (f === 0) continue;
    const p = f / len;
    ent -= p * Math.log2(p);
  }
  // ent is bits per symbol (byte), max 8
  return ent * 1; // bits per byte
}

// Byte variance normalized (0..1)
function byteVarianceNormalized(buf) {
  if (!buf || buf.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  const mean = sum / buf.length;
  let sq = 0;
  for (let i = 0; i < buf.length; i++) {
    const d = buf[i] - mean;
    sq += d * d;
  }
  const variance = sq / buf.length; // raw variance
  // Theoretical max variance for byte values occurs for half 0 and half 255 approx -> var ~ (255^2)/4
  const MAX_VAR_EST = (255 * 255) / 4;
  return Math.min(variance / MAX_VAR_EST, 1);
}

// Bitwise Hamming distance normalized between two buffers (0..1).
function normalizedBitSimilarity(bufA, bufB) {
  const a = toBuffer(bufA);
  const b = toBuffer(bufB);
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let diffBits = 0;
  // Precompute popcount for bytes 0..255
  for (let i = 0; i < len; i++) {
    const x = a[i] ^ b[i];
    diffBits += popcnt8(x);
  }
  const totalBits = len * 8;
  const hamming = diffBits / totalBits; // 0..1 distance
  const similarity = 1 - hamming; // 1 means identical, 0 totally different
  return similarity;
}

const POPCNT_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let v = i;
  let c = 0;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  POPCNT_TABLE[i] = c;
}
function popcnt8(x) {
  return POPCNT_TABLE[x & 0xff];
}

// Split buffer into blocks and compute entropy per block
function blockEntropies(buf, blockSize = 32) {
  const blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) {
    const slice = buf.slice(i, i + blockSize);
    blocks.push(shannonEntropyBits(slice));
  }
  return blocks;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stddev(arr) {
  if (!arr.length) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length;
  return Math.sqrt(v);
}

/* -------------------- Main scoring function -------------------- */

function computeUniquenessScore(allRandomness, options = {}) {
  // Normalize inputs
  let inputs = Array.isArray(allRandomness) ? allRandomness.slice() : [allRandomness];
  inputs = inputs.filter(x => x !== null && x !== undefined);
  if (inputs.length === 0) {
    return {
      score: 0,
      category: 'Low',
      breakdown: {
        entropyNorm: 0,
        nonRepeatNorm: 0,
        amountNorm: 0,
        variationNorm: 0,
        weights: {}
      }
    };
  }
  const buf = concatBuffers(inputs.map(toBuffer));

  const previousRounds = Array.isArray(options.previousRounds) ? options.previousRounds : [];
  const maxBits = options.maxBits || 2048;
  const defaultWeights = { entropy: 0.4, nonRepeat: 0.25, amount: 0.2, variation: 0.15 };
  const weights = Object.assign({}, defaultWeights, options.weights || {});

  // 1) Entropy estimate (normalized 0..1)
  const entropyPerByte = shannonEntropyBits(buf); // 0..8
  const entropyBitsTotal = entropyPerByte * buf.length;
  const entropyNorm = Math.min(entropyPerByte / 8, 1);

  // 2) Amount of input randomness (normalized 0..1)
  const totalBits = buf.length * 8;
  const amountNorm = Math.min(totalBits / maxBits, 1);

  // 3) Variation: measure how entropy fluctuates across blocks
  const blockSize = 32;
  const blockEnt = blockEntropies(buf, blockSize); // array of entropies (bits per byte)
  const meanBlockEnt = mean(blockEnt); // in bits per byte
  const sdBlockEnt = stddev(blockEnt);
  let cov = 0;
  if (meanBlockEnt > 0.0001) cov = sdBlockEnt / meanBlockEnt;
  const variationNorm = Math.min(cov / 0.5, 1);

  // 4) Non-repeatability: compare to previous rounds (0..1). If no history -> best (1).
  let nonRepeatNorm = 1;
  if (previousRounds.length > 0) {
    let maxSim = 0;
    for (const prev of previousRounds) {
      try {
        const sim = normalizedBitSimilarity(buf, prev);
        if (sim > maxSim) maxSim = sim;
      } catch (e) {
        // ignore
      }
    }
    nonRepeatNorm = Math.max(0, 1 - maxSim);
  }

  // Combine metrics using weights to produce final normalized score (0..1)
  const combined =
    (entropyNorm * weights.entropy) +
    (nonRepeatNorm * weights.nonRepeat) +
    (amountNorm * weights.amount) +
    (variationNorm * weights.variation);

  const scoreFloat = Math.max(0, Math.min(1, combined));
  const score = Math.round(scoreFloat * 100);

  // Category mapping
  let category = 'Low';
  if (score >= 85) category = 'High Entropy';
  else if (score >= 65) category = 'Moderate-High';
  else if (score >= 40) category = 'Moderate';
  else category = 'Low';

  return {
    score,
    category,
    breakdown: {
      entropyPerByte: Number(entropyPerByte.toFixed(4)),
      entropyBitsTotal: Math.round(entropyBitsTotal),
      entropyNorm: Number(entropyNorm.toFixed(4)),
      amountBits: totalBits,
      amountNorm: Number(amountNorm.toFixed(4)),
      variationCov: Number(cov.toFixed(4)),
      variationNorm: Number(variationNorm.toFixed(4)),
      nonRepeatNorm: Number(nonRepeatNorm.toFixed(4)),
      weights: Object.assign({}, weights)
    }
  };
}

// ESM exports and compatibility alias
export { computeUniquenessScore };
export const evaluate = computeUniquenessScore;
export default computeUniquenessScore;
