// src/collectors/cryptoCollector.js
// Node.js module that collects secure entropy from the OS CSPRNG (ES module)

import crypto from 'crypto';

/**
 * collectCryptoEntropy(roundId)
 * Returns an object describing entropy and also exports a `collect()` wrapper
 * that returns a Buffer (so safeCollect accepts it).
 */
export async function collectCryptoEntropy(roundId = null) {
  const buf = crypto.randomBytes(32); // 256 bits
  const entropyHex = buf.toString('hex');
  const entropyBase64 = buf.toString('base64');
  const timestamp = Date.now();
  const qualityScore = 1.0;

  return {
    source: 'crypto',
    roundId: roundId || null,
    timestamp,
    entropyHex,
    entropyBase64,
    bits: 256,
    qualityScore,
    notes: 'OS CSPRNG via crypto.randomBytes(32)'
  };
}

/**
 * collect() -- prototype-friendly wrapper that returns Buffer (consistent with other collectors)
 */
export async function collect(roundId = null) {
  const obj = await collectCryptoEntropy(roundId);
  return Buffer.from(obj.entropyHex, 'hex');
}

/* Helper for quick tests */
export function getRandomBufferSync(size = 32) {
  return crypto.randomBytes(size);
}

/* CLI test runner */
if (import.meta.url === `file://${process.cwd()}/src/collectors/cryptoCollector.js` || import.meta.url.endsWith('/src/collectors/cryptoCollector.js')) {
  (async () => {
    try {
      const sample = await collectCryptoEntropy(`test-round-${Date.now()}`);
      console.log(JSON.stringify(sample, null, 2));
    } catch (err) {
      console.error('Error collecting crypto entropy:', err);
      process.exit(1);
    }
  })();
}
