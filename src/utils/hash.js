// src/utils/hash.js
// ESM version
// Common hashing helpers: SHA-256, Blake2b (if supported), Keccak256 (via js-sha3).
// Returns hex strings (lowercase).

import crypto from 'crypto';

let jsKeccak;
try {
  // Dynamic import fallback for optional dependency
  const keccakPkg = await import('js-sha3');
  jsKeccak = keccakPkg.keccak256;
} catch (e) {
  jsKeccak = null;
}

/**
 * Normalize input to Buffer.
 * Accepts: Buffer, string, Uint8Array, Array of bytes.
 */
function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  if (input instanceof Uint8Array || Array.isArray(input)) return Buffer.from(input);
  throw new TypeError('Unsupported input type for hashing');
}

/** SHA-256 */
function sha256(input) {
  const buf = toBuffer(input);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Blake2b-512
 * Uses native Node support if available.
 * Falls back to SHA-256 if not supported.
 */
function blake2b(input) {
  const buf = toBuffer(input);
  try {
    return crypto.createHash('blake2b512').update(buf).digest('hex');
  } catch (e) {
    console.warn(
      'Native blake2b512 not available. Falling back to sha256. ' +
      'Install blakejs if you require true blake2b support.'
    );
    return sha256(buf);
  }
}

/**
 * Keccak-256
 * Uses js-sha3 if installed (recommended for Web3 compatibility)
 */
function keccak256(input) {
  const buf = toBuffer(input);

  if (jsKeccak) {
    return jsKeccak(buf);
  }

  // Try native crypto if available
  try {
    return crypto.createHash('keccak256').update(buf).digest('hex');
  } catch (e) {
    throw new Error(
      'Keccak256 unavailable. Install js-sha3: npm install js-sha3'
    );
  }
}

/**
 * hashAll(list, algorithm)
 * - list: array of inputs (string/Buffer/Uint8Array)
 * - algorithm: 'sha256' | 'blake2b' | 'keccak256'
 */
function hashAll(list, algorithm = 'sha256') {
  if (!Array.isArray(list)) {
    throw new TypeError('hashAll expects an array of inputs');
  }

  const parts = list.map(toBuffer);
  const concat = Buffer.concat(parts);

  switch (algorithm.toLowerCase()) {
    case 'sha256':
      return sha256(concat);
    case 'blake2b':
      return blake2b(concat);
    case 'keccak256':
      return keccak256(concat);
    default:
      throw new Error('Unsupported algorithm: ' + algorithm);
  }
}

/**
 * ESM Exports
 */
export {
  sha256,
  blake2b,
  keccak256,
  hashAll,
};
