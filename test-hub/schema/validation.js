/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {COMPOSITE_REPORT_SCHEMA_VERSION} from './types.js';

const FINDING_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const ARTIFACT_TYPES = new Set([
  'json', 'html', 'image', 'video', 'archive', 'log', 'trace', 'other',
]);
const TEST_STATUSES = new Set([
  'passed', 'failed', 'warning', 'error', 'skipped', 'unknown',
]);
const RUN_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'partial']);

/** @param {unknown} value @param {string} name */
function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

/** @param {unknown} value @param {string} name */
function assertString(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} must be a non-empty string`);
}

/** @param {import('./types.js').ArtifactReference} artifact */
function validateArtifactReference(artifact) {
  assertObject(artifact, 'artifact');
  assertString(artifact.id, 'artifact.id');
  assertString(artifact.providerId, 'artifact.providerId');
  if (!ARTIFACT_TYPES.has(artifact.type)) {
    throw new Error(`Invalid artifact type: ${artifact.type}`);
  }
  if (!artifact.path && !artifact.url) throw new Error('artifact must have a path or url');
  return artifact;
}

/** @param {import('./types.js').Finding} finding */
function validateFinding(finding) {
  assertObject(finding, 'finding');
  assertString(finding.id, 'finding.id');
  assertString(finding.providerId, 'finding.providerId');
  assertString(finding.title, 'finding.title');
  if (!FINDING_SEVERITIES.has(finding.severity)) {
    throw new Error(`Invalid finding severity: ${finding.severity}`);
  }
  finding.evidence?.forEach(validateArtifactReference);
  return finding;
}

/** @param {import('./types.js').TestResult} result */
function validateTestResult(result) {
  assertObject(result, 'test result');
  assertString(result.providerId, 'test result.providerId');
  assertString(result.runId, 'test result.runId');
  assertString(result.title, 'test result.title');
  if (!TEST_STATUSES.has(result.status)) throw new Error(`Invalid test status: ${result.status}`);
  if (!Array.isArray(result.findings)) throw new Error('test result.findings must be an array');
  result.findings.forEach(validateFinding);
  result.artifacts?.forEach(validateArtifactReference);
  if (result.score) {
    const {value, min, max} = result.score;
    if (![value, min, max].every(Number.isFinite) || min > max || value < min || value > max) {
      throw new Error('test result.score must contain finite values within min and max');
    }
  }
  return result;
}

/** @param {import('./types.js').CompositeReport} report */
function validateCompositeReport(report) {
  assertObject(report, 'composite report');
  if (report.schemaVersion !== COMPOSITE_REPORT_SCHEMA_VERSION) {
    throw new Error(`Unsupported CompositeReport schema version: ${report.schemaVersion}`);
  }
  assertObject(report.target, 'composite report.target');
  assertObject(report.run, 'composite report.run');
  assertString(report.run.id, 'composite report.run.id');
  assertString(report.run.startedAt, 'composite report.run.startedAt');
  if (!RUN_STATUSES.has(report.run.status)) {
    throw new Error(`Invalid run status: ${report.run.status}`);
  }
  if (!Array.isArray(report.providerResults) || !Array.isArray(report.findings) ||
      !Array.isArray(report.artifacts) || !Array.isArray(report.executions) ||
      !Array.isArray(report.provenance)) {
    throw new Error('CompositeReport result collections must be arrays');
  }
  report.providerResults.forEach(validateTestResult);
  report.findings.forEach(validateFinding);
  report.artifacts.forEach(validateArtifactReference);
  for (const execution of report.executions) {
    if (!execution || typeof execution !== 'object' ||
        !['queued', 'running', 'completed', 'failed', 'cancelled'].includes(execution.state)) {
      throw new Error('CompositeReport execution reference has an invalid state');
    }
    assertString(execution.providerId, 'execution.providerId');
    assertString(execution.executionMode, 'execution.executionMode');
  }
  return report;
}

export {
  validateArtifactReference,
  validateCompositeReport,
  validateFinding,
  validateTestResult,
};
