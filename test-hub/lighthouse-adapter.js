/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {randomUUID} from 'crypto';

import {COMPOSITE_REPORT_SCHEMA_VERSION} from './schema/types.js';

/**
 * Wraps an existing LHR by reference. It neither clones nor changes the LHR, so
 * Lighthouse JSON and HTML report generation can continue to consume it directly.
 *
 * @param {LH.Result|Record<string, unknown>} lhr
 * @param {{runId?: string, startedAt?: string}=} options
 * @return {import('./schema/types.js').CompositeReport}
 */
export function createCompositeReportFromLhr(lhr, options = {}) {
  const startedAt = options.startedAt || new Date().toISOString();
  const requestedUrl = typeof lhr.requestedUrl === 'string' ? lhr.requestedUrl : undefined;
  const finalUrl = typeof lhr.finalDisplayedUrl === 'string' ? lhr.finalDisplayedUrl :
    typeof lhr.finalUrl === 'string' ? lhr.finalUrl : undefined;
  const version = typeof lhr.lighthouseVersion === 'string' ? lhr.lighthouseVersion : undefined;

  return {
    schemaVersion: COMPOSITE_REPORT_SCHEMA_VERSION,
    target: {requestedUrl, finalUrl},
    run: {
      id: options.runId || randomUUID(),
      startedAt,
      status: 'completed',
    },
    lighthouse: {lhr, version},
    providerResults: [],
    findings: [],
    artifacts: [],
    executions: [],
    provenance: [{
      providerId: 'lighthouse',
      providerVersion: version,
      phase: 'audit',
      status: 'completed',
    }],
  };
}
