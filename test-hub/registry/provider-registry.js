/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {assertTestProvider} from '../provider.js';

export class ProviderRegistry {
  /** @param {import('../schema/types.js').TestProvider[]=} providers */
  constructor(providers = []) {
    /** @type {Map<string, import('../schema/types.js').TestProvider>} */
    this.providers = new Map();
    /** @type {Set<string>} */
    this.enabled = new Set();
    for (const provider of providers) this.register(provider);
  }

  /** @param {import('../schema/types.js').TestProvider} provider */
  register(provider) {
    assertTestProvider(provider);
    const id = provider.metadata().id;
    if (this.providers.has(id)) throw new Error(`Provider already registered: ${id}`);
    this.providers.set(id, provider);
    return provider;
  }

  /** @param {string} id */
  getProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  listProviders() {
    return [...this.providers.values()];
  }

  /** @param {string} id */
  enableProvider(id) {
    this.getProvider(id);
    this.enabled.add(id);
  }

  /** @param {string} id */
  disableProvider(id) {
    this.getProvider(id);
    this.enabled.delete(id);
  }

  listEnabledProviders() {
    return [...this.enabled].map(id => this.getProvider(id));
  }
}
