/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const TEST_HUB_RUN_CONFIG_VERSION = 1;

/** @param {unknown} value @param {string} path @param {string[]} errors */
function validateJsonValue(value, path, errors) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, errors));
    return;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      validateJsonValue(item, `${path}.${key}`, errors);
    }
    return;
  }
  errors.push(`${path} must contain only JSON-serializable values`);
}

/**
 * Validates provider-independent shape, registry membership, and each enabled
 * provider's own configuration.
 * @param {unknown} runConfig
 * @param {import('../registry/provider-registry.js').ProviderRegistry} registry
 */
async function validateTestHubRunConfig(runConfig, registry) {
  const errors = [];
  if (!runConfig || typeof runConfig !== 'object' || Array.isArray(runConfig)) {
    return {valid: false, errors: ['run config must be an object']};
  }
  validateJsonValue(runConfig, 'run config', errors);
  if (runConfig.schemaVersion !== TEST_HUB_RUN_CONFIG_VERSION) {
    errors.push(`schemaVersion must be ${TEST_HUB_RUN_CONFIG_VERSION}`);
  }
  if (!Array.isArray(runConfig.providers)) {
    errors.push('providers must be an array');
    return {valid: false, errors};
  }
  const ids = new Set();
  for (const [index, entry] of runConfig.providers.entries()) {
    const path = `providers[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    if (typeof entry.id !== 'string' || !entry.id) errors.push(`${path}.id is required`);
    if (ids.has(entry.id)) errors.push(`duplicate provider: ${entry.id}`);
    ids.add(entry.id);
    if (typeof entry.enabled !== 'boolean') errors.push(`${path}.enabled must be boolean`);
    if (!entry.enabled) continue;
    let provider;
    try {
      provider = registry.getProvider(entry.id);
    } catch {
      errors.push(`unknown enabled provider: ${entry.id}`);
      continue;
    }
    if (!entry.config || typeof entry.config !== 'object' || Array.isArray(entry.config)) {
      errors.push(`${path}.config must be an object`);
      continue;
    }
    if (typeof entry.config.executionMode !== 'string') {
      errors.push(`${path}.config.executionMode is required`);
      continue;
    }
    const validation = await provider.validateConfig(entry.config);
    if (!validation.valid) {
      errors.push(...(validation.errors || ['invalid provider configuration'])
          .map(error => `${entry.id}: ${error}`));
    }
  }
  if (runConfig.policy !== undefined &&
      (!runConfig.policy || typeof runConfig.policy !== 'object' ||
       Array.isArray(runConfig.policy))) {
    errors.push('policy must be an object');
  }
  if (runConfig.policy?.continueOnProviderError !== undefined &&
      typeof runConfig.policy.continueOnProviderError !== 'boolean') {
    errors.push('policy.continueOnProviderError must be boolean');
  }
  return {valid: errors.length === 0, errors};
}

/**
 * @param {unknown} runConfig
 * @param {import('../registry/provider-registry.js').ProviderRegistry} registry
 */
async function assertTestHubRunConfig(runConfig, registry) {
  const validation = await validateTestHubRunConfig(runConfig, registry);
  if (!validation.valid) {
    throw new Error(`Invalid TestHubRunConfig: ${validation.errors.join('; ')}`);
  }
}

export {assertTestHubRunConfig, TEST_HUB_RUN_CONFIG_VERSION, validateTestHubRunConfig};
