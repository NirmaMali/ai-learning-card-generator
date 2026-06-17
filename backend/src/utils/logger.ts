/**
 * Simple colored console logger using ANSI escape codes.
 *
 * Why not use a library like winston or pino?
 * This project is small enough that a lightweight, zero-dependency logger
 * keeps the dependency tree lean. Swap this out if structured logging
 * or log-file rotation becomes necessary.
 */

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

// Level labels with fixed-width padding for aligned output
const LEVEL_LABELS = {
  info: `${COLORS.green}[INFO] ${COLORS.reset}`,
  warn: `${COLORS.yellow}[WARN] ${COLORS.reset}`,
  error: `${COLORS.red}[ERROR]${COLORS.reset}`,
  debug: `${COLORS.gray}[DEBUG]${COLORS.reset}`,
} as const;

function getTimestamp(): string {
  return `${COLORS.cyan}${new Date().toISOString()}${COLORS.reset}`;
}

const MODULE_NAME = 'backend';

export const logger = {
  info(message: string): void {
    console.log(`${getTimestamp()} ${LEVEL_LABELS.info} [${MODULE_NAME}] ${message}`);
  },

  warn(message: string): void {
    console.warn(`${getTimestamp()} ${LEVEL_LABELS.warn} [${MODULE_NAME}] ${message}`);
  },

  error(message: string): void {
    console.error(`${getTimestamp()} ${LEVEL_LABELS.error} [${MODULE_NAME}] ${message}`);
  },

  debug(message: string): void {
    // Only emit debug logs when NODE_ENV is not 'production'
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`${getTimestamp()} ${LEVEL_LABELS.debug} [${MODULE_NAME}] ${message}`);
    }
  },
};
