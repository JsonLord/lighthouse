/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {trailblazeManifest} from './manifest.js';

/** @param {unknown} status */
function normalizeStatus(status) {
  const value = String(status || '').toUpperCase();
  if (['PASS', 'PASSED', 'SUCCESS', 'SUCCEEDED'].includes(value)) return 'PASS';
  if (['FAIL', 'FAILED', 'FAILURE', 'ERROR'].includes(value)) return 'FAIL';
  if (['SKIP', 'SKIPPED'].includes(value)) return 'SKIP';
  return 'UNKNOWN';
}

/** @param {Record<string, unknown>} resultJson */
function normalizePinnedSummary(resultJson) {
  if (Array.isArray(resultJson.results)) {
    const results = resultJson.results;
    const steps = results.map(result => ({
      name: result.title || result.test_key || result.session_id || 'Trailblaze journey',
      status: normalizeStatus(result.outcome),
      message: result.failure_reason || result.failure_stack,
    }));
    const failed = steps.some(step => step.status === 'FAIL');
    const skipped = steps.length > 0 && steps.every(step => step.status === 'SKIP');
    const started = results.map(result => result.started_at).filter(Boolean).sort()[0];
    const completed = results.map(result => result.completed_at).filter(Boolean).sort().at(-1);
    return {
      name: results.length === 1 ? steps[0].name : 'Trailblaze web journeys',
      status: failed ? 'FAIL' : skipped ? 'SKIP' : 'PASS',
      steps,
      startedAt: started,
      completedAt: completed,
      durationMs: results.reduce((total, result) => total + (result.duration_ms || 0), 0),
    };
  }
  const steps = Array.isArray(resultJson.steps) ? resultJson.steps : [];
  const normalizedSteps = steps.map((step, index) => ({
    name: step.name || step.description || `Step ${index + 1}`,
    status: normalizeStatus(step.status ?? step.result),
    message: step.error?.message || step.error || step.message,
  }));
  const status = normalizeStatus(resultJson.status ?? resultJson.result);
  if (status === 'UNKNOWN') throw new Error('Malformed Trailblaze summary: status is missing');
  return {
    name: resultJson.testName || resultJson.name || 'Trailblaze web trail',
    status,
    steps: normalizedSteps,
    startedAt: resultJson.startedAt,
    completedAt: resultJson.completedAt,
    durationMs: resultJson.durationMs,
  };
}

/** @param {Record<string, unknown>} resultJson */
function normalizeFixtureSummary(resultJson) {
  if (!Array.isArray(resultJson.journeys)) {
    throw new Error('Malformed Trailblaze result');
  }
  const failed = resultJson.journeys.filter(journey => journey.status === 'FAIL');
  const passed = resultJson.journeys.filter(journey => journey.status === 'PASS');
  return {
    name: 'Trailblaze web journeys',
    status: failed.length ? 'FAIL' : 'PASS',
    steps: resultJson.journeys,
    summary: `${passed.length} passed, ${failed.length} failed`,
    startedAt: resultJson.startedAt,
    completedAt: resultJson.completedAt,
    durationMs: resultJson.durationMs,
  };
}

/**
 * @param {unknown} rawResult
 * @param {import('../../schema/types.js').ProviderContext} context
 * @return {Promise<import('../../schema/types.js').TestResult>}
 */
export async function normalizeTrailblazeResult(rawResult, context) {
  const resultJson = rawResult?.resultJson ?? rawResult;
  if (!resultJson || typeof resultJson !== 'object' || Array.isArray(resultJson)) {
    throw new Error('Malformed Trailblaze result: expected an object');
  }
  const summary = rawResult?.executionMode === 'fixture' ?
    normalizeFixtureSummary(resultJson) : normalizePinnedSummary(resultJson);
  const failed = summary.steps.filter(step => normalizeStatus(step.status) === 'FAIL');
  const findings = failed.map((step, index) => ({
    id: `trailblaze-${index + 1}-${String(step.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    providerId: trailblazeManifest.id,
    title: `${step.name} failed`,
    description: step.message || 'The trail step did not complete successfully.',
    severity: /** @type {const} */ ('high'),
    category: 'journey',
    location: {step: step.failedStep || step.name},
    recommendation: 'Review the journey steps and associated Trailblaze evidence.',
    metadata: {stepStatus: step.status},
  }));

  return {
    providerId: trailblazeManifest.id,
    providerVersion: trailblazeManifest.version,
    runId: context.runId,
    status: summary.status === 'FAIL' ? 'failed' :
      summary.status === 'SKIP' ? 'skipped' : 'passed',
    title: summary.name,
    summary: summary.summary || `${failed.length} of ${summary.steps.length} steps failed`,
    // Journey suites intentionally have no synthetic numeric score.
    findings,
    metrics: {
      executionMode: rawResult?.executionMode || 'fixture',
      steps: summary.steps.map(({name, status}) => ({name, status: normalizeStatus(status)})),
    },
    rawResult: resultJson,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    durationMs: summary.durationMs,
  };
}
