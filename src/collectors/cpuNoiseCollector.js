// src/collectors/cpuNoiseCollector.js
// ES module version for FLUQ Alpha 1.0
// Exports: async function collect(options = {}) -> returns Buffer (sha512 digest of raw timing samples)

import crypto from 'crypto';

/**
 * Collect CPU timing jitter and return a fixed-size entropy blob as a Buffer.
 * The exported function is `collect(options)` which returns a Buffer containing
 * the 512-bit (sha512) digest of the raw timing sample buffer.
 *
 * Options:
 *   - durationMs: maximum time to sample (default 2000 ms)
 *   - sampleTarget: desired number of raw timing samples (default 4096)
 *   - busyWork: inner-loop iterations to create measurable jitter (default 20)
 */
export async function collect(options = {}) {
  const {
    durationMs = 2000,
    sampleTarget = 4096,
    busyWork = 20
  } = options;

  const startTime = process.hrtime.bigint();
  const startMs = Date.now();
  const deadline = startTime + BigInt(durationMs) * BigInt(1e6); // convert ms to ns

  const samples = [];
  let last = process.hrtime.bigint();

  // Collect timing deltas until we hit sampleTarget or timeout
  while ((samples.length < sampleTarget) && (process.hrtime.bigint() < deadline)) {
    // tiny busy work to introduce instruction timing variation
    let dummy = 0;
    for (let k = 0; k < busyWork; k++) {
      // do non-optimizable ops
      dummy = (dummy + k * (k ^ (Number(last) & 0xff))) | 0;
    }

    const now = process.hrtime.bigint();
    const deltaNs = now - last;
    last = now;

    // clamp to safe Number for storage
    const deltaNum = Number(deltaNs > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : deltaNs);
    samples.push(deltaNum);
  }

  const endMs = Date.now();
  const actualDurationMs = endMs - startMs;

  // Pack samples into a Buffer (little-endian 64-bit per sample)
  const buf = Buffer.allocUnsafe(samples.length * 8);
  for (let i = 0; i < samples.length; i++) {
    const v = BigInt(Math.floor(samples[i]));
    buf.writeBigUInt64LE(v, i * 8);
  }

  // Hash the raw sample buffer to a fixed-size entropy blob (sha512 -> 512 bits)
  const hashAlgo = 'sha512';
  const digest = crypto.createHash(hashAlgo).update(buf).digest(); // Buffer (64 bytes)

  // Note: we return the raw digest Buffer so the index/safeCollect normalization handles it
  return digest;
}

/**
 * Optional: helper to produce a diagnostic object (not used by safeCollect)
 * You can import this for debugging if desired:
 *
 * import { collectDetailed } from './cpuNoiseCollector.js'
 */
export async function collectDetailed(options = {}) {
  const {
    durationMs = 2000,
    sampleTarget = 4096,
    busyWork = 20
  } = options;

  const startTime = process.hrtime.bigint();
  const startMs = Date.now();
  const deadline = startTime + BigInt(durationMs) * BigInt(1e6);

  const samples = [];
  let last = process.hrtime.bigint();

  while ((samples.length < sampleTarget) && (process.hrtime.bigint() < deadline)) {
    let dummy = 0;
    for (let k = 0; k < busyWork; k++) {
      dummy = (dummy + k * (k ^ (Number(last) & 0xff))) | 0;
    }
    const now = process.hrtime.bigint();
    const deltaNs = now - last;
    last = now;
    const deltaNum = Number(deltaNs > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : deltaNs);
    samples.push(deltaNum);
  }

  const endMs = Date.now();
  const actualDurationMs = endMs - startMs;

  const buf = Buffer.allocUnsafe(samples.length * 8);
  for (let i = 0; i < samples.length; i++) {
    const v = BigInt(Math.floor(samples[i]));
    buf.writeBigUInt64LE(v, i * 8);
  }

  const hashAlgo = 'sha512';
  const E_i_hex = crypto.createHash(hashAlgo).update(buf).digest('hex');

  const stats = computeStats(samples);

  return {
    E_i: '0x' + E_i_hex,
    rawSampleCount: samples.length,
    durationMs: actualDurationMs,
    rawSamplesPreview: samples.slice(0, Math.min(200, samples.length)),
    stats,
    hashAlgo
  };
}

function computeStats(arr) {
  if (!arr || arr.length === 0) return { min: 0, max: 0, mean: 0, median: 0, variance: 0 };
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const n = arr.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = (n % 2 === 1) ? sorted[(n - 1) / 2] : ((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
  const variance = sorted.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  return { min, max, mean, median, variance };
}
