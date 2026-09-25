/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @typedef {(entry: {providerId: string, event: string, message: string, data?: Record<string, unknown>}) => void} ProviderLogger */

/** @type {ProviderLogger} */
const silentLogger = () => {};

/** @returns {ProviderLogger} */
function createConsoleLogger() {
  return entry => {
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    process.stderr.write(`[${entry.providerId}] ${entry.message}${data}\n`);
  };
}

export {createConsoleLogger, silentLogger};
