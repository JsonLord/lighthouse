/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert/strict';

import {createCompositeReportFromLhr} from '../lighthouse-adapter.js';
import {
  validateArtifactReference,
  validateCompositeReport,
  validateFinding,
  validateTestResult,
} from '../schema/validation.js';

describe('Test Hub schemas', () => {
  it('validates a Lighthouse-only CompositeReport', () => {
    const lhr = {requestedUrl: 'https://example.com', finalDisplayedUrl: 'https://example.com'};
    const report = createCompositeReportFromLhr(lhr, {runId: 'schema-run'});
    assert.equal(validateCompositeReport(report), report);
    assert.equal(report.lighthouse?.lhr, lhr);
    assert.deepEqual(report.providerResults, []);
  });

  it('validates a partial CompositeReport', () => {
    const report = createCompositeReportFromLhr({}, {runId: 'partial-run'});
    report.run.status = 'partial';
    assert.equal(validateCompositeReport(report).run.status, 'partial');
  });

  it('accepts a provider result without a numeric score', () => {
    const result = {
      providerId: 'pass-fail',
      runId: 'run',
      status: /** @type {const} */ ('passed'),
      title: 'Pass/fail check',
      findings: [],
    };
    assert.equal(validateTestResult(result), result);
    assert.equal('score' in result, false);
  });

  it('rejects an unknown finding severity', () => {
    const finding = {id: 'f', providerId: 'p', title: 'Finding', severity: 'urgent'};
    // @ts-expect-error Deliberately exercises invalid runtime input.
    assert.throws(() => validateFinding(finding), /Invalid finding severity/);
  });

  it('validates artifact references', () => {
    const artifact = {
      id: 'report',
      providerId: 'provider',
      type: /** @type {const} */ ('html'),
      path: '/tmp/report.html',
    };
    assert.equal(validateArtifactReference(artifact), artifact);
    assert.throws(() => validateArtifactReference({...artifact, path: undefined}), /path or url/);
  });
});
