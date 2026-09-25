/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

import {
  buildDeviceListCommand,
  buildReportCommand,
  buildRunCommand,
  buildVersionCommand,
} from '../providers/trailblaze/commands.js';

describe('Trailblaze v2026.09.11 CLI contract', () => {
  it('builds the version and diagnostic device commands', () => {
    assert.deepEqual(buildVersionCommand(), ['--version']);
    assert.deepEqual(buildDeviceListCommand(), ['device', 'list']);
  });

  it('builds a web, daemonless run with a positional trail', () => {
    assert.deepEqual(buildRunCommand({
      trailPath: '/absolute/path/test.trail.yaml',
      testName: 'test-hub-run-123',
    }), [
      'run', '--device', 'web', '--no-daemon', '--test-name', 'test-hub-run-123',
      '/absolute/path/test.trail.yaml',
    ]);
  });

  it('builds a canonical report command', () => {
    assert.deepEqual(buildReportCommand('session-123', '/isolated/report'), [
      'report', '--id', 'session-123', '--output-dir', '/isolated/report',
    ]);
  });
});
