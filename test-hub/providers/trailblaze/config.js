/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {access, stat} from 'node:fs/promises';
import path from 'node:path';

import {TRAILBLAZE_BROWSERS, TRAILBLAZE_TEST_CATALOG} from './catalog.js';

const DEFAULT_TRAILBLAZE_TIMEOUT_MS = 10 * 60 * 1000;

/** @param {unknown} config */
async function validateTrailblazeConfig(config) {
  const value = /** @type {Record<string, unknown>} */ (
    config && typeof config === 'object' ? config : {});
  const mode = value.executionMode ?? 'fixture';
  const errors = [];
  if (!['fixture', 'github-actions', 'local-cli'].includes(mode)) {
    errors.push(`Unsupported executionMode: ${mode}`);
  }
  if (mode === 'github-actions') {
    const allowedKeys = new Set(['executionMode', 'test', 'browser']);
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) errors.push(`Unsupported github-actions option: ${key}`);
    }
    if (typeof value.test !== 'string' || !(value.test in TRAILBLAZE_TEST_CATALOG)) {
      errors.push('test must be a controlled Trailblaze test ID');
    }
    if (typeof value.browser !== 'string' || !TRAILBLAZE_BROWSERS.includes(value.browser)) {
      errors.push(`browser must be one of: ${TRAILBLAZE_BROWSERS.join(', ')}`);
    }
  }
  if (mode === 'local-cli') {
    if (typeof value.trailPath !== 'string' || !path.isAbsolute(value.trailPath)) {
      errors.push('trailPath must be an absolute path');
    } else {
      try {
        if (!(await stat(value.trailPath)).isFile()) errors.push('trailPath must be a file');
        await access(value.trailPath);
      } catch {
        errors.push('trailPath does not exist or is not readable');
      }
    }
  }
  if (value.workingDirectory !== undefined) {
    if (typeof value.workingDirectory !== 'string' || !path.isAbsolute(value.workingDirectory)) {
      errors.push('workingDirectory must be an absolute path');
    } else {
      try {
        if (!(await stat(value.workingDirectory)).isDirectory()) {
          errors.push('workingDirectory must be a directory');
        }
      } catch {
        errors.push('workingDirectory does not exist');
      }
    }
  }
  if (value.artifactDirectory !== undefined &&
      (typeof value.artifactDirectory !== 'string' || !path.isAbsolute(value.artifactDirectory))) {
    errors.push('artifactDirectory must be an absolute path');
  }
  if (value.timeoutMs !== undefined &&
      (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 ||
       value.timeoutMs > 3_600_000)) {
    errors.push('timeoutMs must be an integer between 1000 and 3600000');
  }
  return {valid: errors.length === 0, errors};
}

/** @param {unknown} config */
function getExecutionMode(config) {
  const value = /** @type {Record<string, unknown>} */ (
    config && typeof config === 'object' ? config : {});
  return value.executionMode || 'fixture';
}

export {DEFAULT_TRAILBLAZE_TIMEOUT_MS, getExecutionMode, validateTrailblazeConfig};
