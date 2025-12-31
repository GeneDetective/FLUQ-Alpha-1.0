// src/detector/cheatDetector.js
/**
 * cheatDetector.js (ESM)
 * -----------------
 * Detects basic cheating patterns in randomness:
 * 1. Too many repeated values
 * 2. Too similar to previous round
 * 3. Too little variation (low entropy)
 */

import crypto from "crypto"; // kept for parity with original (unused but OK)

/**
 * calculateEntropy(buffer)
 */
function calculateEntropy(buffer) {
    const freq = {};
    for (const byte of buffer) {
        freq[byte] = (freq[byte] || 0) + 1;
    }

    let entropy = 0;
    const total = buffer.length;

    for (const count of Object.values(freq)) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }

    return entropy;
}

/**
 * bufferSimilarity(buf1, buf2)
 */
function bufferSimilarity(buf1, buf2) {
    if (!buf1 || !buf2) return 0;

    let same = 0;
    const len = Math.min(buf1.length, buf2.length);

    for (let i = 0; i < len; i++) {
        if (buf1[i] === buf2[i]) same++;
    }

    return (same / len) * 100; // return percentage
}

/**
 * detectCheating(currentRandomness, previousRandomness = null)
 */
function detectCheating(currentRandomness, previousRandomness = null) {
    const result = { cheated: false, reason: null };

    // -------------------------------
    // 1. Repetition Check
    // -------------------------------
    const repetitions = {};
    for (const byte of currentRandomness) {
        repetitions[byte] = (repetitions[byte] || 0) + 1;
        if (repetitions[byte] > currentRandomness.length * 0.5) {
            return {
                cheated: true,
                reason: "Too many repeated values (low randomness)"
            };
        }
    }

    // -------------------------------
    // 2. Similarity Check (vs previous round)
    // -------------------------------
    if (previousRandomness) {
        const similarity = bufferSimilarity(currentRandomness, previousRandomness);

        if (similarity > 85) {
            return {
                cheated: true,
                reason: `Randomness is suspiciously similar to previous round (${similarity.toFixed(2)}%)`
            };
        }
    }

    // -------------------------------
    // 3. Entropy Check
    // -------------------------------
    const entropy = calculateEntropy(currentRandomness);

    if (entropy < 4.0) {
        return {
            cheated: true,
            reason: `Entropy too low (${entropy.toFixed(2)})`
        };
    }

    // If everything is OK
    return result;
}

// Export as named ESM exports and provide alias `check` for compatibility
export { detectCheating };
export const check = detectCheating;
export default detectCheating;
