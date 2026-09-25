/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

import {detectTrailblaze} from '../providers/trailblaze/availability.js';

const localConfig = {executionMode: 'local-cli'};

describe('Trailblaze availability', () => {
  it('reports installed CLI and web capability', async () => {
    const result = await detectTrailblaze(localConfig, {
      runProcess: async () => ({exitCode: 0, stdout: 'trailblaze v2026.09.11\n', stderr: ''}),
    });
    assert.equal(result.available, true);
    assert.equal(result.reason, 'installed');
    assert.equal(result.version, 'v2026.09.11');
    assert.equal(result.versionStatus, 'supported');
    assert.deepEqual(result.capabilities, ['web']);
  });

  it('reports a missing executable', async () => {
    const result = await detectTrailblaze(localConfig, {
      runProcess: async () => ({spawnError: {code: 'ENOENT'}, exitCode: -2}),
    });
    assert.equal(result.available, false);
    assert.equal(result.reason, 'not-installed');
  });

  it('distinguishes older, newer, and invalid versions', async () => {
    for (const [output, reason] of [
      ['v2026.09.10', 'unsupported-older'],
      ['v2026.09.12', 'untested-newer'],
      ['1.0.0', 'invalid-version'],
    ]) {
      const result = await detectTrailblaze(localConfig, {
        runProcess: async () => ({exitCode: 0, stdout: output, stderr: ''}),
      });
      assert.equal(result.reason, reason);
    }
  });

  it('reports version command failures', async () => {
    const result = await detectTrailblaze(localConfig, {
      runProcess: async () => ({exitCode: 2, stdout: '', stderr: 'failure'}),
    });
    assert.equal(result.reason, 'error');
  });
});
