// src/collectors/keyboardCollector.js
// ESM Node.js keyboard entropy collector for FLUQ Alpha 1.0
// Usage (module): import { collectKeyboardEntropy } from './collectors/keyboardCollector.js'
// Usage (CLI):  node src/collectors/keyboardCollector.js

import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

export async function collectKeyboardEntropy(roundId = 'round-0', options = {}) {
  const {
    sampleCount = 64,
    maxDurationMs = 15000,
    interactive = false
  } = options;

  if (interactive) {
    console.log(`FLUQ keyboard collector starting — round=${roundId}`);
    console.log(`Press keys (will collect ${sampleCount} samples or stop after ${maxDurationMs}ms).`);
    console.log('Press ESC or Ctrl+C to stop early.');
  }

  const samples = [];

  const nowNs = () => {
    try { return process.hrtime.bigint(); }
    catch (e) { return BigInt(Date.now()) * 1000000n; }
  };

  return new Promise((resolve, reject) => {
    let lastTs = nowNs();

    function finish(reason = 'done') {
      try {
        if (process.stdin && process.stdin.isTTY) {
          process.stdin.setRawMode && process.stdin.setRawMode(false);
          process.stdin.pause();
        } else {
          process.stdin.removeAllListeners('data');
        }
      } catch (e) { /* ignore */ }

      if (interactive) console.log(`\nStopping capture (${reason}). Collected ${samples.length} samples.`);

      // Build a deterministic digest: include metadata + each sample
      const hash = crypto.createHash('sha512');
      hash.update(String(roundId));
      hash.update('\nPID:' + process.pid);
      hash.update('\nUP:' + process.uptime());

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        hash.update('TS:' + s.ts.toString());
        hash.update('DELTA:' + s.delta.toString());
        if (s.key && s.key.length) hash.update(Buffer.from(s.key));
        hash.update('|');
      }

      const digest = hash.digest(); // Buffer (64 bytes)
      resolve({
        roundId,
        bytes: digest,
        hex: digest.toString('hex'),
        samplesCount: samples.length
      });
    }

    const stdinIsTTY = !!(process.stdin && process.stdin.isTTY);

    if (!stdinIsTTY) {
      // Non-interactive environment: read lines as fallback
      if (interactive) console.log('stdin is not a TTY — falling back to line-based capture. Press Enter to submit samples.');
      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      process.stdin.on('data', (chunk) => {
        const ts = nowNs();
        const delta = ts - lastTs;
        lastTs = ts;
        samples.push({ ts, delta, key: Buffer.from(String(chunk)) });
        if (samples.length >= sampleCount) {
          process.stdin.removeAllListeners('data');
          finish('sampleCount reached (non-TTY)');
        }
      });

      // timeout fallback
      setTimeout(() => {
        finish('timeout (non-TTY)');
      }, Math.max(1000, maxDurationMs));

      return;
    }

    // TTY: raw mode capture
    process.stdin.setRawMode && process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('binary');

    function onData(chunk) {
      try {
        const ts = nowNs();
        const delta = ts - lastTs;
        lastTs = ts;
        const buf = Buffer.from(String(chunk), 'binary');
        samples.push({ ts, delta, key: buf });

        if (interactive) process.stdout.write('.');

        if (samples.length >= sampleCount) {
          process.stdin.removeListener('data', onData);
          process.stdin.removeListener('data', onControl);
          finish('sampleCount reached');
        }
      } catch (err) {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('data', onControl);
        finish('error');
      }
    }

    function onControl(chunk) {
      const b = Buffer.from(String(chunk), 'binary');
      if (b.includes(0x1b) || b.includes(0x03) || b.includes(0x04)) {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('data', onControl);
        finish('stopped by user');
      }
    }

    process.stdin.on('data', onData);
    process.stdin.on('data', onControl);

    // safety timeout
    setTimeout(() => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('data', onControl);
      finish('timeout');
    }, Math.max(1000, maxDurationMs));
  });
}

// If run directly with `node src/collectors/keyboardCollector.js`, run demo
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  (async () => {
    try {
      const res = await collectKeyboardEntropy('demo-round', { sampleCount: 64, maxDurationMs: 15000, interactive: true });
      console.log('\n\nEntropy (hex):', res.hex);
      console.log('Bytes length:', res.bytes.length);
      console.log('Samples collected:', res.samplesCount);
      process.exit(0);
    } catch (e) {
      console.error('Error collecting entropy:', e);
      process.exit(1);
    }
  })();
}
