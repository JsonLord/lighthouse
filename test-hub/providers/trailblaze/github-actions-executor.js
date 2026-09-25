/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {getTrailblazeTest} from './catalog.js';

const TRAILBLAZE_WORKFLOW = 'test-hub-trailblaze.yml';

class TrailblazeGitHubActionsExecutor {
  /** @param {import('../../execution/github-actions/executor.js').GitHubActionsExecutor} executor */
  constructor(executor) {
    this.executor = executor;
  }

  /** @param {import('../../schema/types.js').ProviderContext} context */
  async dispatch(context) {
    const config = /** @type {Record<string, string>} */ (context.config);
    getTrailblazeTest(config.test);
    const executionReference = await this.executor.dispatch({
      testHubRunId: context.runId,
      providerId: 'trailblaze',
      inputs: {
        test_hub_run_id: context.runId,
        provider_id: 'trailblaze',
        test_id: config.test,
        browser: config.browser,
      },
    });
    return {executionState: 'queued', executionReference};
  }

  /** @param {Record<string, unknown>} executionReference */
  async resume(executionReference) {
    const updated = await this.executor.getStatus(executionReference);
    if (['queued', 'running'].includes(updated.state)) {
      return {executionState: updated.state, executionReference: updated};
    }
    if (updated.state !== 'completed') {
      const error = /** @type {Error & {executionState?: string}} */ (
        new Error(`GitHub Actions workflow ${updated.state}`));
      error.executionState = updated.state;
      throw error;
    }
    const imported = await this.executor.getArtifacts(updated);
    return {
      executionState: 'completed',
      executionReference: updated,
      executionMode: 'github-actions',
      resultJson: imported.summary,
      remoteMetadata: imported.metadata,
      remoteFiles: imported.files,
      remoteReferences: imported.references,
    };
  }
}

export {TRAILBLAZE_WORKFLOW, TrailblazeGitHubActionsExecutor};
