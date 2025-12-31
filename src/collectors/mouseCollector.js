// src/collectors/mouseCollector.js
// ESM browser mouse/pointer entropy collector for FLUQ Alpha 1.0
// Usage in browser:
//   <script type="module">
//     import { startMouseCollector, stopMouseCollector, getEntropyChunk } from './src/collectors/mouseCollector.js';
//     startMouseCollector();
//     // later:
//     const hex = await getEntropyChunk('round-123', 'optional-secret');
//   </script>

const DEFAULT_OPTIONS = {
  sampleLimit: 5000,
  sampleMinDeltaMs: 0,
  minSamplesForChunk: 16,
  includeDeviceFingerprint: true,
};

let opts = { ...DEFAULT_OPTIONS };
let samples = [];
let running = false;
let pointerHandler = null;

export function startMouseCollector(options = {}) {
  if (running) return;
  opts = { ...DEFAULT_OPTIONS, ...options };
  samples = [];

  pointerHandler = (ev) => {
    try {
      const t = performance.now();
      const x = (ev.clientX !== undefined) ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX) || 0;
      const y = (ev.clientY !== undefined) ? ev.clientY : (ev.touches && ev.touches[0] && ev.touches[0].clientY) || 0;
      if (opts.sampleMinDeltaMs > 0 && samples.length) {
        const last = samples[samples.length - 1];
        if ((t - last.t) < opts.sampleMinDeltaMs) return;
      }
      samples.push({ x: Math.round(x), y: Math.round(y), t: Math.round(t) });
      if (samples.length > opts.sampleLimit) samples.shift();
    } catch (e) {
      // ignore
    }
  };

  window.addEventListener('pointermove', pointerHandler, { passive: true });
  running = true;
}

export function stopMouseCollector() {
  if (!running) return;
  window.removeEventListener('pointermove', pointerHandler, { passive: true });
  pointerHandler = null;
  running = false;
}

export function getSampleCount() {
  return samples.length;
}

export function clearSamples() {
  samples = [];
}

function strToArrayBuffer(str) {
  const enc = new TextEncoder();
  return enc.encode(str).buffer;
}

function concatArrayBuffers(buffers) {
  const total = buffers.reduce((s, b) => s + b.byteLength, 0);
  const tmp = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    tmp.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return tmp.buffer;
}

function bufToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hex;
}

export async function getEntropyChunk(roundId = '', secret = '') {
  const snap = samples.slice();
  if (snap.length < Math.max(4, opts.minSamplesForChunk)) {
    console.warn(`mouseCollector: only ${snap.length} samples available when creating entropy chunk. More movement recommended.`);
  }

  const buffers = [];
  buffers.push(strToArrayBuffer(`round:${roundId}`));
  buffers.push(strToArrayBuffer(`secret:${secret}`));

  const now = performance.now();
  const nowBuf = new ArrayBuffer(8);
  new DataView(nowBuf).setFloat64(0, now);
  buffers.push(nowBuf);

  if (opts.includeDeviceFingerprint) {
    try {
      const fp = [
        navigator.userAgent || '',
        navigator.platform || '',
        screen?.width || 0,
        screen?.height || 0,
        navigator.hardwareConcurrency || 0,
        Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || ''
      ].join('|');
      buffers.push(strToArrayBuffer(`fp:${fp}`));
    } catch (e) { /* ignore */ }
  }

  if (snap.length > 0) {
    const firstT = snap[0].t || 0;
    const perSampleSize = 2 + 2 + 4;
    const slab = new ArrayBuffer(snap.length * perSampleSize);
    const dv = new DataView(slab);
    for (let i = 0; i < snap.length; i++) {
      const s = snap[i];
      const x = Math.max(-32768, Math.min(32767, s.x || 0));
      const y = Math.max(-32768, Math.min(32767, s.y || 0));
      const dt = Math.max(0, Math.round((s.t || 0) - firstT));
      dv.setInt16(i * perSampleSize + 0, x, true);
      dv.setInt16(i * perSampleSize + 2, y, true);
      dv.setUint32(i * perSampleSize + 4, dt, true);
    }
    buffers.push(slab);
  }

  try {
    const jitterBuf = new ArrayBuffer(8);
    new DataView(jitterBuf).setFloat64(0, performance.now());
    buffers.push(jitterBuf);
  } catch (e) { /* ignore */ }

  const blob = concatArrayBuffers(buffers);

  // Web Crypto API — available in browsers. Returns ArrayBuffer.
  const hashBuffer = await crypto.subtle.digest('SHA-512', blob);
  return bufToHex(hashBuffer);
}
