/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** @type {import('../../schema/types.js').ProviderMetadata} */
export const trailblazeManifest = {
  id: 'trailblaze',
  name: 'Trailblaze',
  description: 'GitHub-hosted web user-journey testing with no local installation.',
  version: '2.0.0',
  category: 'journey',
  execution: 'github-actions',
  pricing: 'free',
  homepage: 'https://github.com/block/trailblaze',
  repository: 'https://github.com/block/trailblaze',
  license: 'Apache-2.0',
  capabilities: [
    'web', 'journey-testing', 'screenshots', 'trace', 'github-actions', 'no-installation',
  ],
  permissions: ['network-access', 'external-api'],
  configurable: true,
};
