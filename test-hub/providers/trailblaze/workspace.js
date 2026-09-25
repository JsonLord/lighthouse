/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {mkdir} from 'node:fs/promises';
import path from 'node:path';

/** @param {string} value */
function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

/** @param {string} runId @param {Record<string, unknown>} config */
export async function createTrailblazeWorkspace(runId, config) {
  const base = typeof config.artifactDirectory === 'string' ?
    path.join(config.artifactDirectory, safeSegment(runId), 'trailblaze') :
    path.resolve('.tmp', 'test-hub', safeSegment(runId), 'trailblaze');
  const sessionDirectory = path.join(base, 'session');
  const reportDirectory = path.join(base, 'report');
  await Promise.all([
    mkdir(sessionDirectory, {recursive: true}),
    mkdir(reportDirectory, {recursive: true}),
  ]);
  return {
    root: base,
    sessionDirectory,
    reportDirectory,
    resultPath: path.join(reportDirectory, 'summary.json'),
  };
}
