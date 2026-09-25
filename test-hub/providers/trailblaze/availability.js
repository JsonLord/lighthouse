/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {runProcess} from '../../runtime/process-runner.js';
import {buildVersionCommand, SUPPORTED_TRAILBLAZE_RELEASE} from './commands.js';
import {getExecutionMode} from './config.js';

const DATE_VERSION_PATTERN = /(?:^|\s)v?(\d{4})\.(\d{2})\.(\d{2})(?:\s|$)/;

/** @param {string} output */
function parseTrailblazeVersion(output) {
  const match = output.match(DATE_VERSION_PATTERN);
  if (!match) return {status: 'invalid-version'};
  const release = `v${match[1]}.${match[2]}.${match[3]}`;
  const supportedDate = SUPPORTED_TRAILBLAZE_RELEASE.slice(1).replaceAll('.', '');
  const actualDate = release.slice(1).replaceAll('.', '');
  if (release === SUPPORTED_TRAILBLAZE_RELEASE) return {status: 'supported', release};
  if (actualDate > supportedDate) return {status: 'untested-newer', release};
  return {status: 'unsupported-older', release};
}

/**
 * Availability intentionally uses only the stable version command. `device
 * list` is human-readable in the pinned release and is diagnostic, not a gate.
 * @param {unknown} config
 * @param {{runProcess?: typeof runProcess}=} dependencies
 */
async function detectTrailblaze(config, dependencies = {}) {
  if (getExecutionMode(config) === 'fixture') {
    return {available: true, reason: 'fixture', executionMode: 'fixture'};
  }
  const execute = dependencies.runProcess || runProcess;
  const execution = await execute({command: 'trailblaze', args: buildVersionCommand()});
  if (execution.spawnError?.code === 'ENOENT') {
    return {available: false, reason: 'not-installed', message: 'Trailblaze CLI was not found'};
  }
  if (execution.spawnError || execution.exitCode !== 0) {
    return {available: false, reason: 'error', message: 'Trailblaze version check failed'};
  }
  const version = parseTrailblazeVersion(execution.stdout || execution.stderr);
  if (version.status !== 'supported') {
    return {
      available: false,
      reason: version.status,
      message: `Trailblaze ${SUPPORTED_TRAILBLAZE_RELEASE} is required`,
      version: version.release,
    };
  }
  return {
    available: true,
    reason: 'installed',
    versionStatus: version.status,
    cliPath: 'trailblaze',
    version: version.release,
    platform: process.platform,
    capabilities: ['web'],
  };
}

export {detectTrailblaze, parseTrailblazeVersion};
