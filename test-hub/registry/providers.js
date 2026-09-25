/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {ProviderRegistry} from './provider-registry.js';
import {createTrailblazeProvider} from '../providers/trailblaze/provider.js';

/** Creates an isolated built-in registry; activation is intentionally in-memory. */
export function createBuiltinRegistry(dependencies = {}) {
  return new ProviderRegistry([createTrailblazeProvider(dependencies.trailblaze)]);
}
