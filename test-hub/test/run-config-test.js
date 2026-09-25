/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {validateTestHubRunConfig} from '../config/run-config.js';
import {createBuiltinRegistry} from '../registry/providers.js';

const registry = createBuiltinRegistry();
const entry = config => ({id: 'trailblaze', enabled: true, config});

describe('TestHubRunConfig', () => {
  it('accepts fixture and GitHub Actions configurations', async () => {
    for (const config of [
      {executionMode: 'fixture'},
      {executionMode: 'github-actions', test: 'checkout', browser: 'chromium'},
    ]) {
      const result = await validateTestHubRunConfig({
        schemaVersion: 1, providers: [entry(config)],
      }, registry);
      assert.equal(result.valid, true, result.errors.join('; '));
    }
  });

  it('accepts advanced local CLI configuration', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'run-config-'));
    const trailPath = path.join(directory, 'test.trail');
    await writeFile(trailPath, 'trail');
    const result = await validateTestHubRunConfig({
      schemaVersion: 1,
      providers: [entry({executionMode: 'local-cli', trailPath})],
    }, registry);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('rejects unknown enabled and duplicate providers', async () => {
    const unknown = await validateTestHubRunConfig({
      schemaVersion: 1,
      providers: [{id: 'unknown', enabled: true, config: {executionMode: 'fixture'}}],
    }, registry);
    assert.match(unknown.errors.join(' '), /unknown enabled provider/);
    const duplicate = await validateTestHubRunConfig({
      schemaVersion: 1,
      providers: [entry({executionMode: 'fixture'}), entry({executionMode: 'fixture'})],
    }, registry);
    assert.match(duplicate.errors.join(' '), /duplicate provider/);
  });

  it('does not execute or validate disabled providers', async () => {
    const result = await validateTestHubRunConfig({
      schemaVersion: 1,
      providers: [{id: 'not-installed', enabled: false, config: {dangerous: () => {}}}],
    }, registry);
    assert.equal(result.valid, false, 'functions remain forbidden even for disabled entries');
    const safeDisabled = await validateTestHubRunConfig({
      schemaVersion: 1,
      providers: [{id: 'not-installed', enabled: false, config: {executionMode: 'anything'}}],
    }, registry);
    assert.equal(safeDisabled.valid, true);
  });

  it('round-trips through JSON serialization', async () => {
    const config = {
      schemaVersion: 1,
      providers: [entry({executionMode: 'github-actions', test: 'login', browser: 'chromium'})],
      policy: {continueOnProviderError: true},
    };
    const roundTrip = JSON.parse(JSON.stringify(config));
    assert.deepEqual(roundTrip, config);
    assert.equal((await validateTestHubRunConfig(roundTrip, registry)).valid, true);
  });
});
