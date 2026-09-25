/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

import {GitHubActionsClient} from '../execution/github-actions/client.js';
import {GitHubActionsExecutor} from '../execution/github-actions/executor.js';

function createHarness(overrides = {}) {
  const calls = [];
  const transport = {
    dispatchWorkflow: async request => {
      calls.push(['dispatch', request]);
      return {runId: 42, runUrl: 'https://github.example/runs/42'};
    },
    getWorkflowRun: async () => ({status: 'queued'}),
    listArtifacts: async () => [{id: 7, name: 'test-hub-trailblaze-run-1'}],
    downloadArtifact: async () => ({
      files: {
        'metadata.json': {
          schemaVersion: 1, testHubRunId: 'run-1', providerId: 'trailblaze',
          workflow: 'test-hub-trailblaze.yml',
        },
        'summary.json': {status: 'PASSED', steps: []},
        'report-interactive.html': '<html></html>',
      },
      references: {'report-interactive.html': 'https://backend.example/artifacts/report.html'},
    }),
    cancelWorkflow: async request => calls.push(['cancel', request]),
    ...overrides,
  };
  const executor = new GitHubActionsExecutor({
    client: new GitHubActionsClient(transport),
    repository: 'JsonLord/lighthouse',
    workflow: 'test-hub-trailblaze.yml',
  });
  return {calls, executor};
}

describe('GitHubActionsExecutor', () => {
  it('dispatches controlled workflow inputs and returns a safe reference', async () => {
    const {calls, executor} = createHarness();
    const reference = await executor.dispatch({
      testHubRunId: 'run-1', providerId: 'trailblaze', inputs: {test_id: 'checkout'},
    });
    assert.equal(reference.state, 'queued');
    assert.equal(reference.remote.runId, 42);
    assert.equal('token' in reference.remote, false);
    assert.equal(calls[0][1].workflow, 'test-hub-trailblaze.yml');
  });

  it('maps queued, running, completed, failed, and cancelled states', async () => {
    for (const [workflowRun, state] of [
      [{status: 'queued'}, 'queued'],
      [{status: 'in_progress'}, 'running'],
      [{status: 'completed', conclusion: 'success'}, 'completed'],
      [{status: 'completed', conclusion: 'failure'}, 'failed'],
      [{status: 'completed', conclusion: 'cancelled'}, 'cancelled'],
    ]) {
      const {executor} = createHarness({getWorkflowRun: async () => workflowRun});
      const updated = await executor.getStatus({remote: {}});
      assert.equal(updated.state, state);
    }
  });

  it('imports validated summary and report artifacts', async () => {
    const {executor} = createHarness();
    const result = await executor.getArtifacts({
      providerId: 'trailblaze', testHubRunId: 'run-1',
      remote: {workflow: 'test-hub-trailblaze.yml'},
    });
    assert.equal(result.summary.status, 'PASSED');
    assert.match(result.references['report-interactive.html'], /^https:/);
  });

  it('rejects missing, wrong, and mismatched artifacts', async () => {
    const reference = {providerId: 'trailblaze', testHubRunId: 'run-1',
      remote: {workflow: 'test-hub-trailblaze.yml'}};
    await assert.rejects(createHarness({listArtifacts: async () => []}).executor
        .getArtifacts(reference), /not found/);
    await assert.rejects(createHarness({
      listArtifacts: async () => [{id: 1, name: 'other-artifact'}],
    }).executor.getArtifacts(reference), /not found/);
    await assert.rejects(createHarness({downloadArtifact: async () => ({files: {
      'metadata.json': {schemaVersion: 1, testHubRunId: 'wrong', providerId: 'trailblaze',
        workflow: 'test-hub-trailblaze.yml'},
      'summary.json': {},
    }})}).executor.getArtifacts(reference), /does not match/);
  });

  it('cancels through the backend client', async () => {
    const {calls, executor} = createHarness();
    const result = await executor.cancel({remote: {runId: 42}});
    assert.equal(result.state, 'cancelled');
    assert.equal(calls[0][0], 'cancel');
  });
});
