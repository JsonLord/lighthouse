/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {importGitHubActionsArtifact} from './artifacts.js';
import {normalizeGitHubActionsStatus} from './status.js';

class GitHubActionsExecutor {
  /** @param {{client: import('./client.js').GitHubActionsClient, repository: string, workflow: string, ref?: string}} options */
  constructor(options) {
    this.client = options.client;
    this.repository = options.repository;
    this.workflow = options.workflow;
    this.ref = options.ref || 'main';
  }

  /** @param {{testHubRunId: string, providerId: string, inputs: Record<string, string>}} request */
  async dispatch(request) {
    const run = await this.client.dispatchWorkflow({
      repository: this.repository,
      workflow: this.workflow,
      ref: this.ref,
      inputs: request.inputs,
    });
    if (!Number.isSafeInteger(run.runId) || typeof run.runUrl !== 'string') {
      throw new Error('GitHub Actions dispatch did not return a valid run reference');
    }
    return {
      providerId: request.providerId,
      executionMode: 'github-actions',
      state: 'queued',
      testHubRunId: request.testHubRunId,
      remote: {
        provider: 'github-actions',
        repository: this.repository,
        workflow: this.workflow,
        runId: run.runId,
        runUrl: run.runUrl,
      },
    };
  }

  /** @param {Record<string, unknown>} reference */
  async getStatus(reference) {
    const run = await this.client.getWorkflowRun(reference.remote);
    return {...reference, state: normalizeGitHubActionsStatus(run)};
  }

  /** @param {Record<string, unknown>} reference */
  async getArtifacts(reference) {
    const artifacts = await this.client.listArtifacts(reference.remote);
    const expectedName = `test-hub-${reference.providerId}-${reference.testHubRunId}`;
    const artifact = artifacts.find(item => item.name === expectedName);
    if (!artifact) throw new Error(`Expected GitHub Actions artifact not found: ${expectedName}`);
    const bundle = await this.client.downloadArtifact({
      ...reference.remote,
      artifactId: artifact.id,
    });
    return importGitHubActionsArtifact(bundle, {
      testHubRunId: reference.testHubRunId,
      providerId: reference.providerId,
      workflow: reference.remote.workflow,
    });
  }

  /** @param {Record<string, unknown>} reference */
  async cancel(reference) {
    await this.client.cancelWorkflow(reference.remote);
    return {...reference, state: 'cancelled'};
  }
}

export {GitHubActionsExecutor};
