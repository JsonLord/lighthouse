/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {assertTestHubRunConfig} from '../config/run-config.js';
import {createCompositeReportFromLhr} from '../lighthouse-adapter.js';
import {validateCompositeReport, validateTestResult} from '../schema/validation.js';

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {import('../schema/types.js').CompositeReport} report @param {import('../schema/types.js').TestResult} result */
function addResult(report, result) {
  validateTestResult(result);
  report.providerResults.push(result);
  report.findings.push(...result.findings);
  report.artifacts.push(...(result.artifacts || []));
  if (result.cost) (report.costs ||= {records: []}).records.push(result.cost);
}

export class TestHubOrchestrator {
  /**
   * @param {import('../registry/provider-registry.js').ProviderRegistry} registry
   * @param {{now?: () => Date}=} options
   */
  constructor(registry, options = {}) {
    this.registry = registry;
    this.now = options.now || (() => new Date());
  }

  /**
   * Starts configured providers. Remote dispatches return while queued/running;
   * call `resume()` later to poll and import their results.
   * @param {LH.Result|Record<string, unknown>} lhr
   * @param {unknown} runConfig
   * @param {{runId?: string}=} options
   */
  async run(lhr, runConfig, options = {}) {
    await assertTestHubRunConfig(runConfig, this.registry);
    const started = this.now();
    const report = createCompositeReportFromLhr(lhr, {
      runId: options.runId,
      startedAt: started.toISOString(),
    });
    const entries = runConfig.providers.filter(entry => entry.enabled);
    for (const entry of entries) {
      const shouldContinue = await this.#startProvider(report, entry);
      if (!shouldContinue && runConfig.policy?.continueOnProviderError === false) break;
    }
    this.#updateRunTiming(report, started);
    validateCompositeReport(report);
    return report;
  }

  /**
   * Polls all pending remote executions once. This method never blocks waiting
   * for a workflow transition.
   * @param {import('../schema/types.js').CompositeReport} report
   * @param {unknown} runConfig
   */
  async resume(report, runConfig) {
    await assertTestHubRunConfig(runConfig, this.registry);
    for (const execution of report.executions.filter(item =>
      item.state === 'queued' || item.state === 'running')) {
      const entry = runConfig.providers.find(item =>
        item.enabled && item.id === execution.providerId);
      if (!entry) throw new Error(`Missing run configuration for ${execution.providerId}`);
      const provider = this.registry.getProvider(execution.providerId);
      const context = {runId: report.run.id, providerId: entry.id, config: entry.config};
      try {
        if (!provider.resume) throw new Error('Provider does not support asynchronous execution');
        const resumed = await provider.resume(execution, context);
        Object.assign(execution, resumed.executionReference || {}, {state: resumed.executionState});
        if (resumed.executionState !== 'completed') continue;
        const result = await provider.normalize(resumed, context);
        const artifacts = await provider.collectArtifacts?.(resumed, context) || [];
        if (artifacts.length) result.artifacts = [...(result.artifacts || []), ...artifacts];
        addResult(report, result);
        report.provenance.push({
          providerId: entry.id,
          providerVersion: provider.metadata().version,
          phase: 'remote-import',
          status: 'completed',
        });
      } catch (error) {
        const executionState = /** @type {{executionState?: string}} */ (error)?.executionState;
        execution.state = executionState && ['failed', 'cancelled'].includes(executionState) ?
          executionState : 'failed';
        this.#addProviderError(report, provider, context, 'remote-execution', error);
      }
    }
    this.#updateRunTiming(report, new Date(report.run.startedAt));
    validateCompositeReport(report);
    return report;
  }

  /** @param {import('../schema/types.js').CompositeReport} report @param {Record<string, unknown>} entry */
  async #startProvider(report, entry) {
    const provider = this.registry.getProvider(entry.id);
    const metadata = provider.metadata();
    const context = {runId: report.run.id, providerId: metadata.id, config: entry.config};
    const request = {target: report.target};
    let phase = 'availability';
    try {
      const availability = await provider.availability(context);
      if (!availability.available) {
        throw new Error(availability.message || availability.reason || 'Provider unavailable');
      }
      phase = 'prepare';
      await provider.prepare?.(request, context);
      phase = 'execution';
      const rawResult = await provider.run(request, context);
      if (rawResult?.executionReference &&
          ['queued', 'running'].includes(rawResult.executionState)) {
        report.executions.push(rawResult.executionReference);
        report.run.status = 'running';
        report.provenance.push({
          providerId: metadata.id,
          providerVersion: metadata.version,
          phase: 'dispatch',
          status: 'completed',
        });
        return true;
      }
      phase = 'normalization';
      const result = await provider.normalize(rawResult, context);
      phase = 'artifacts';
      const artifacts = await provider.collectArtifacts?.(rawResult, context) || [];
      if (artifacts.length) result.artifacts = [...(result.artifacts || []), ...artifacts];
      addResult(report, result);
      report.provenance.push({
        providerId: metadata.id,
        providerVersion: metadata.version,
        phase: 'run',
        status: 'completed',
      });
      return true;
    } catch (error) {
      this.#addProviderError(report, provider, context, phase, error);
      return false;
    } finally {
      try {
        await provider.cleanup?.(context);
      } catch (error) {
        this.#addProvenanceError(report, metadata, 'cleanup', error);
      }
    }
  }

  #addProviderError(report, provider, context, phase, error) {
    report.run.status = 'partial';
    const metadata = provider.metadata();
    const message = errorMessage(error);
    report.providerResults.push({
      providerId: metadata.id,
      providerVersion: metadata.version,
      runId: context.runId,
      status: 'error',
      title: metadata.name,
      summary: `${phase} failed: ${message}`,
      findings: [],
    });
    this.#addProvenanceError(report, metadata, phase, error);
  }

  #addProvenanceError(report, metadata, phase, error) {
    report.run.status = 'partial';
    report.provenance.push({
      providerId: metadata.id,
      providerVersion: metadata.version,
      phase,
      status: 'failed',
      message: errorMessage(error),
    });
  }

  #updateRunTiming(report, started) {
    const pending = report.executions.some(item =>
      item.state === 'queued' || item.state === 'running');
    if (pending) {
      report.run.status = 'running';
      delete report.run.completedAt;
      delete report.run.durationMs;
      return;
    }
    if (report.run.status === 'running') report.run.status = 'completed';
    const completed = this.now();
    report.run.completedAt = completed.toISOString();
    report.run.durationMs = Math.max(0, completed.getTime() - started.getTime());
  }
}
