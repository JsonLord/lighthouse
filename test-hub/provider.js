/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runtime assertion for the TestProvider contract. Optional lifecycle methods
 * are feature-detected by the orchestrator.
 * @param {unknown} provider
 * @return {asserts provider is import('./schema/types.js').TestProvider}
 */
export function assertTestProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new Error('Provider must be an object');
  for (const method of ['metadata', 'availability', 'validateConfig', 'run', 'normalize']) {
    if (typeof provider[method] !== 'function') {
      throw new Error(`Provider must implement ${method}()`);
    }
  }
  const metadata = provider.metadata();
  if (!metadata || typeof metadata.id !== 'string' || !metadata.id) {
    throw new Error('Provider metadata must include an id');
  }
}
