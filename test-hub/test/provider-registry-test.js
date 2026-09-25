/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert/strict';

import {createBuiltinRegistry} from '../registry/providers.js';

describe('ProviderRegistry', () => {
  it('lists and looks up the Trailblaze provider', () => {
    const registry = createBuiltinRegistry();
    assert.deepEqual(registry.listProviders().map(provider => provider.metadata().id),
      ['trailblaze']);
    assert.equal(registry.getProvider('trailblaze').metadata().name, 'Trailblaze');
  });

  it('enables and disables providers', () => {
    const registry = createBuiltinRegistry();
    registry.enableProvider('trailblaze');
    assert.deepEqual(registry.listEnabledProviders().map(provider => provider.metadata().id),
      ['trailblaze']);
    registry.disableProvider('trailblaze');
    assert.deepEqual(registry.listEnabledProviders(), []);
  });

  it('rejects unknown providers', () => {
    const registry = createBuiltinRegistry();
    assert.throws(() => registry.getProvider('unknown'), /Unknown provider: unknown/);
    assert.throws(() => registry.enableProvider('unknown'), /Unknown provider: unknown/);
    assert.throws(() => registry.disableProvider('unknown'), /Unknown provider: unknown/);
  });
});
