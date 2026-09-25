/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {GitHubActionsClient} from '../execution/github-actions/client.js';
import {GitHubActionsExecutor} from '../execution/github-actions/executor.js';
import {TestHubOrchestrator} from '../orchestrator/orchestrator.js';
import {createTrailblazeProvider} from '../providers/trailblaze/provider.js';
import {ProviderRegistry} from '../registry/provider-registry.js';
import {createBuiltinRegistry} from '../registry/providers.js';

const lhr = {
  lighthouseVersion: '13.5.0',
  requestedUrl: 'https://example.com/',
  finalDisplayedUrl: 'https://www.example.com/',
  audits: {},
  categories: {},
};

const emptyRunConfig = {schemaVersion: 1, providers: []};
/** @param {string} id @param {Record<string, unknown>} config */
const runConfigFor = (id, config = {executionMode: 'fixture'}) => ({
  schemaVersion: 1,
  providers: [{id, enabled: true, config}],
  policy: {continueOnProviderError: true},
});

/** @param {Partial<import('../schema/types.js').TestProvider>=} overrides */
function makeProvider(overrides = {}) {
  return {
    metadata: () => ({
      id: 'fixture-provider',
      name: 'Fixture provider',
      description: 'Test fixture',
      category: /** @type {const} */ ('other'),
      execution: /** @type {const} */ ('builtin'),
      pricing: /** @type {const} */ ('free'),
    }),
    availability: async () => ({available: true}),
    validateConfig: async () => ({valid: true}),
    run: async () => ({ok: true}),
    normalize: async (raw, context) => ({
      providerId: context.providerId,
      runId: context.runId,
      status: /** @type {const} */ ('passed'),
      title: 'Fixture result',
      findings: [],
      rawResult: raw,
    }),
    ...overrides,
  };
}

describe('TestHubOrchestrator', () => {
  it('creates a Lighthouse-only report and preserves the original LHR', async () => {
    const snapshot = structuredClone(lhr);
    const registry = createBuiltinRegistry();
    registry.enableProvider('trailblaze');
    const report = await new TestHubOrchestrator(registry)
        .run(lhr, emptyRunConfig, {runId: 'lh-only'});
    assert.equal(report.run.status, 'completed');
    assert.equal(report.lighthouse?.lhr, lhr);
    assert.deepEqual(lhr, snapshot);
    assert.deepEqual(report.providerResults, []);
    assert.deepEqual(report.executions, []);
    assert.equal(report.target.finalUrl, 'https://www.example.com/');
  });

  it('combines Lighthouse with normalized Trailblaze results and findings', async () => {
    const registry = createBuiltinRegistry();
    const report = await new TestHubOrchestrator(registry)
        .run(lhr, runConfigFor('trailblaze'), {runId: 'combined'});
    assert.equal(report.run.status, 'completed');
    assert.equal(report.providerResults[0].providerId, 'trailblaze');
    assert.equal(report.providerResults[0].score, undefined);
    assert.equal(report.findings.length, 1);
    assert.equal(report.artifacts.length, 2);
  });

  it('isolates provider execution failure and marks the report partial', async () => {
    const provider = makeProvider({run: async () => {
      throw new Error('runner crashed');
    }});
    const registry = new ProviderRegistry([provider]);
    const snapshot = structuredClone(lhr);
    const report = await new TestHubOrchestrator(registry)
        .run(lhr, runConfigFor('fixture-provider'), {runId: 'failed'});
    assert.equal(report.run.status, 'partial');
    assert.equal(report.providerResults[0].status, 'error');
    assert.match(report.providerResults[0].summary || '', /execution failed: runner crashed/);
    assert.equal(report.lighthouse?.lhr, lhr);
    assert.deepEqual(lhr, snapshot);
  });

  it('isolates normalization failure without corrupting the LHR', async () => {
    const provider = makeProvider({normalize: async () => {
      throw new Error('bad payload');
    }});
    const registry = new ProviderRegistry([provider]);
    const snapshot = structuredClone(lhr);
    const report = await new TestHubOrchestrator(registry)
        .run(lhr, runConfigFor('fixture-provider'), {runId: 'bad-normalization'});
    assert.equal(report.run.status, 'partial');
    assert.match(report.providerResults[0].summary || '', /normalization failed: bad payload/);
    assert.deepEqual(lhr, snapshot);
  });

  it('reports unavailable providers as partial without calling run', async () => {
    let didRun = false;
    const provider = makeProvider({
      availability: async () => ({available: false, reason: 'CLI unavailable'}),
      run: async () => {
        didRun = true;
      },
    });
    const registry = new ProviderRegistry([provider]);
    const report = await new TestHubOrchestrator(registry)
        .run(lhr, runConfigFor('fixture-provider'), {runId: 'unavailable'});
    assert.equal(report.run.status, 'partial');
    assert.equal(didRun, false);
    assert.match(report.providerResults[0].summary || '', /CLI unavailable/);
  });

  it('isolates unavailable local Trailblaze from Lighthouse', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'tb-unavailable-'));
    const trailPath = path.join(directory, 'test.trail');
    await writeFile(trailPath, 'trail');
    const provider = createTrailblazeProvider({
      runProcess: async () => ({spawnError: {code: 'ENOENT'}, exitCode: -2}),
    });
    const registry = new ProviderRegistry([provider]);
    const report = await new TestHubOrchestrator(registry).run(lhr,
      runConfigFor('trailblaze', {executionMode: 'local-cli', trailPath}));
    assert.equal(report.run.status, 'partial');
    assert.match(report.providerResults[0].summary || '', /Trailblaze CLI was not found/);
  });

  it('distinguishes Trailblaze infrastructure failure from a failed journey', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'tb-orchestrator-'));
    const trailPath = path.join(directory, 'test.trail');
    await writeFile(trailPath, 'trail');
    let call = 0;
    const provider = createTrailblazeProvider({runProcess: async () => {
      call++;
      if (call === 1) return {exitCode: 0, stdout: 'v2026.09.11', stderr: ''};
      return {exitCode: 8, stdout: '', stderr: 'crashed', timedOut: false};
    }});
    const registry = new ProviderRegistry([provider]);
    const report = await new TestHubOrchestrator(registry).run(lhr,
      runConfigFor('trailblaze', {
        executionMode: 'local-cli', trailPath,
        artifactDirectory: path.join(directory, 'output'),
      }));
    assert.equal(report.run.status, 'partial');
    assert.equal(report.providerResults[0].status, 'error');
    assert.match(report.providerResults[0].summary || '', /exited with code 8/);
  });

  it('dispatches remotely, resumes later, and keeps failed verdict separate', async () => {
    const transport = {
      dispatchWorkflow: async () => ({runId: 99, runUrl: 'https://github.example/runs/99'}),
      getWorkflowRun: async () => ({status: 'completed', conclusion: 'success'}),
      listArtifacts: async () => [{id: 1, name: 'test-hub-trailblaze-remote-run'}],
      downloadArtifact: async () => ({
        files: {
          'metadata.json': {schemaVersion: 1, testHubRunId: 'remote-run',
            providerId: 'trailblaze', workflow: 'test-hub-trailblaze.yml'},
          'summary.json': {testName: 'Checkout', status: 'FAILED',
            steps: [{name: 'Submit order', status: 'FAILED'}]},
          'report-interactive.html': '<html></html>',
        },
        references: {
          'report-interactive.html': 'https://backend.example/artifacts/trace.html',
        },
      }),
      cancelWorkflow: async () => {},
    };
    const githubActionsExecutor = new GitHubActionsExecutor({
      client: new GitHubActionsClient(transport),
      repository: 'JsonLord/lighthouse',
      workflow: 'test-hub-trailblaze.yml',
    });
    const provider = createTrailblazeProvider({githubActionsExecutor});
    const registry = new ProviderRegistry([provider]);
    const runConfig = runConfigFor('trailblaze', {
      executionMode: 'github-actions', test: 'checkout', browser: 'chromium',
    });
    const orchestrator = new TestHubOrchestrator(registry);
    const report = await orchestrator.run(lhr, runConfig, {runId: 'remote-run'});
    assert.equal(report.run.status, 'running');
    assert.equal(report.executions[0].state, 'queued');
    assert.deepEqual(report.providerResults, []);

    await orchestrator.resume(report, runConfig);
    assert.equal(report.run.status, 'completed');
    assert.equal(report.executions[0].state, 'completed');
    assert.equal(report.providerResults[0].status, 'failed');
    assert.equal(report.artifacts[0].type, 'html');
    assert.equal(report.executions[0].remote.runUrl, 'https://github.example/runs/99');
  });
});
