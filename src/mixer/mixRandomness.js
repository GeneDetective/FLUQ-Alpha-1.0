// src/mixer/mixRandomness.js (ESM)
/**
 * mixRandomness.js (ESM)
 *
 * Purpose:
 *  - Take an array of randomness inputs (Buffer or hex/string)
 *  - Securely shuffle them (cryptographically secure Fisher-Yates using crypto.randomInt)
 *  - Concatenate them, optionally include salt/roundId/prevHash
 *  - Compute final SHA-256 hash which is the round's final randomness seed
 *
 * Exports:
 *  - async function mixRandomness(inputs, opts)
 */

import crypto from 'crypto';

/** Ensure value is a Buffer. Accepts Buffer, hex string, or utf8 string. */
function toBuffer(x) {
  if (Buffer.isBuffer(x)) return x;
  if (typeof x === 'string') {
    // If it looks like hex (only [0-9a-fA-F] and even length), parse as hex,
    // otherwise treat as utf8 text.
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (hexRegex.test(x) && x.length % 2 === 0) {
      return Buffer.from(x, 'hex');
    }
    return Buffer.from(x, 'utf8');
  }
  // fallback: JSON serialize
  return Buffer.from(JSON.stringify(x), 'utf8');
}

/** Cryptographically secure in-place Fisher-Yates shuffle using crypto.randomInt */
function secureShuffle(buffers) {
  // Make a shallow copy to avoid mutating caller's array
  const arr = buffers.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    // randomInt upper bound is exclusive
    const j = crypto.randomInt(0, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Compute sha256 hex digest of a Buffer */
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * mixRandomness
 * @param {Array<Buffer|string>} inputs
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function mixRandomness(inputs, opts = {}) {
  if (!Array.isArray(inputs)) {
    throw new Error('inputs must be an array of Buffers or strings');
  }

  // Convert inputs to Buffers
  const buffers = inputs.map(toBuffer);

  // Optional fields
  const saltBuf = opts.salt ? toBuffer(opts.salt) : Buffer.alloc(0);
  const roundBuf = (opts.roundId !== undefined && opts.roundId !== null)
    ? toBuffer(String(opts.roundId))
    : Buffer.alloc(0);
  const prevBuf = opts.prevHash ? toBuffer(opts.prevHash) : Buffer.alloc(0);

  // Secure shuffle the buffers
  const shuffled = secureShuffle(buffers);

  // For transparency, produce hex strings of shuffled pieces
  const shuffledHex = shuffled.map((b) => b.toString('hex'));

  // Concatenate: [salt || roundId || prevHash || shuffled pieces...]
  const concatenationParts = [];
  if (saltBuf.length > 0) concatenationParts.push(saltBuf);
  if (roundBuf.length > 0) concatenationParts.push(roundBuf);
  if (prevBuf.length > 0) concatenationParts.push(prevBuf);
  concatenationParts.push(...shuffled);

  const concatenated = Buffer.concat(concatenationParts);

  // Compute final hash (round seed)
  const finalHash = sha256Hex(concatenated);

  return {
    finalHash,                      // hex string of final SHA-256
    shuffledHex,                    // array of hex strings (each input after shuffle)
    concatenatedHex: concatenated.toString('hex'),
    preImageHex: concatenated.toString('hex') // same as concatenatedHex (kept name for clarity)
  };
}

// ESM export
export { mixRandomness };
export default mixRandomness;
