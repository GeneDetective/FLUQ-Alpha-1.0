# FLUQ Alpha 1.0

FLUQ Alpha 1.0 is a **very early-stage experimental prototype** for a decentralized randomness aggregation and scoring system.  
It is designed to **collect entropy from multiple independent sources**, securely mix them, analyze their quality, detect suspicious patterns, and finally **reward contributors based on the uniqueness and entropy of the randomness produced**.

This project is **not production-ready**. It is an _alpha research prototype_ meant for learning, experimentation, and architectural validation.

---

## Introduction

Modern systems often rely on randomness for security, fairness, and unpredictability. FLUQ explores a concept where:

- Multiple entropy sources contribute randomness
- Inputs are mixed securely
- Randomness quality is scored
- Cheating or low-entropy behavior is detected
- Contributors are rewarded proportionally

FLUQ Alpha demonstrates this idea using Node.js, combining both **system-level entropy** and **human interaction–based entropy**.

---

## What This Tool Does

FLUQ Alpha performs the following steps in a single round:

1. Collects randomness from multiple collectors:
   - OS cryptographic randomness
   - CPU timing jitter
   - Keyboard interaction (optional / fallback)
   - Mouse movement (browser-side or fallback)

2. Mixes all entropy sources securely using cryptographic shuffling and hashing.

3. Detects cheating or suspicious patterns such as:
   - Excessive repetition
   - High similarity to previous rounds
   - Low Shannon entropy

4. Scores the final randomness using multiple metrics:
   - Entropy strength
   - Non-repeatability
   - Amount of randomness
   - Structural variation

5. Rewards tokens based on the final score.

---

## Project Status

- Version: Alpha 1.0
- Stability: Experimental
- Security: Not audited
- Intended Use: Research, learning, prototyping

_Do not use this system in production or for real economic value._

---

## Requirements

- Node.js v16 or later
- npm (comes with Node.js)
- Git

Operating systems supported:
- Windows
- Linux
- macOS

---

## How to Clone the Repository

```bash
git clone https://github.com/GeneDetective/FLUQ-Alpha-1.0.git
cd FLUQ-Alpha-1.0

Install Dependencies

npm install

This will install required dependencies such as js-sha3.
How to Run FLUQ Alpha

To run a single randomness round:

node src/index.js

Expected Output

When you run the program, you will see output similar to the following:

{
  "source": "crypto",
  "roundId": "test-round-1767185406085",
  "timestamp": 1767185406085,
  "entropyHex": "95393f41cbf0a2d498f2e5a9543fd914ba93ea5747385a00b4b9a1087a8be2cd",
  "entropyBase64": "lTk/QcvwotSY8uWpVD/ZFLqT6ldHOFoAtLmhCHqL4s0=",
  "bits": 256,
  "qualityScore": 1,
  "notes": "OS CSPRNG via crypto.randomBytes(32)"
}

Followed by structured logs:

[YYYY-MM-DD HH:MM:SS.mmm] [INFO] --- FLUQ Alpha 1.0: Starting round ---
[INFO] Round ID: round-XXXXXXXXXXXX
[INFO] Prev round hash: 000000...000
[INFO] Collecting entropy from collectors...
[WARN] mouseCollector fallback used
[WARN] keyboardCollector fallback used
[INFO] Mixing entropy sources
[INFO] Uniqueness score computed
[INFO] Reward issued

Warnings are normal in Alpha mode when interactive collectors are unavailable.
Folder Structure Overview

src/
├── collectors/
│   ├── cryptoCollector.js
│   ├── cpuNoiseCollector.js
│   ├── keyboardCollector.js
│   └── mouseCollector.js
├── detector/
│   └── cheatDetector.js
├── mixer/
│   └── mixRandomness.js
├── scoring/
│   └── uniquenessScore.js
├── token/
│   └── rewardEngine.js
├── utils/
│   ├── hash.js
│   └── logger.js
└── index.js

Entropy Sources Explained

cryptoCollector
Uses crypto.randomBytes(32) to obtain 256 bits of OS-level cryptographic randomness.

cpuNoiseCollector
Uses high-resolution CPU timing jitter to extract entropy from micro-variations in execution time.

keyboardCollector
Collects entropy from keypress timings and key data. Falls back automatically if no TTY is available.

mouseCollector
Collects entropy from mouse or pointer movement in browser environments. Node fallback is used if unavailable.
Scoring System

The uniqueness score ranges from 0 to 100 and is derived from:

    Shannon entropy

    Input size

    Variation across blocks

    Non-repeatability across rounds

Score categories:

    85–100 → High Entropy

    65–84 → Moderate-High

    40–64 → Moderate

    Below 40 → Low

Reward Logic

Token rewards are assigned as follows:

    Score > 80 → 5 FLUQ tokens

    Score between 50 and 80 → 3 FLUQ tokens

    Score below 50 → 1 FLUQ token

Rewards are handled in-memory only in this prototype.
Logging

FLUQ uses a timestamped logging system with levels:

    debug

    info

    warn

    error

You can optionally log to a file:

set LOG_FILE=fluq.log
node src/index.js

Important Notes

    This project is experimental.

    Outputs are for demonstration purposes.

    Some collectors intentionally fall back to avoid blocking execution.

    Token balances are not persisted.

Future Work (Planned)

    Persistent storage

    Networked multi-node rounds

    Cryptographic commitments and reveal phases

    Browser + Node hybrid execution

    Formal randomness proofs

    Smart contract integration

License

This project is provided for educational and research purposes only.
License details can be added later as the project matures.
Final Note

FLUQ Alpha 1.0 is a conceptual foundation, not a finished system.
Expect breaking changes, incomplete features, and evolving architecture.

Contributions, experiments, and critiques are welcome.

