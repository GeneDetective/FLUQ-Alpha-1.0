// src/utils/logger.js
// ESM version
// Simple timestamped logger used across FLUQ code.
// Supports levels: debug, info, warn, error.
// Optional: set LOG_FILE environment variable to append logs to file.

import fs from 'fs';
import path from 'path';

const LOG_FILE = process.env.LOG_FILE || null;

/**
 * Format timestamp like YYYY-MM-DD HH:MM:SS.mmm
 */
function now() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}.${ms}`;
}

function format(level, msg) {
  const ts = now();

  if (typeof msg === 'object') {
    try {
      msg = JSON.stringify(msg);
    } catch (e) {
      msg = String(msg);
    }
  }

  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

function writeLog(str) {
  console.log(str);

  if (LOG_FILE) {
    try {
      fs.appendFileSync(LOG_FILE, str + '\n');
    } catch (e) {
      // Never crash on logging failure
      console.error('Logger: failed to write to log file:', e.message);
    }
  }
}

function debug(msg) { writeLog(format('debug', msg)); }
function info(msg)  { writeLog(format('info', msg)); }
function warn(msg)  { writeLog(format('warn', msg)); }
function error(msg) { writeLog(format('error', msg)); }

/**
 * ESM Exports
 */
export {
  debug,
  info,
  warn,
  error,
};
