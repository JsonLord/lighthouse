#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {readFile} from 'fs/promises';

import {GitHubActionsClient} from './execution/github-actions/client.js';
import {GitHubActionsExecutor} from './execution/github-actions/executor.js';
import {TestHubOrchestrator} from './orchestrator/orchestrator.js';
import {createBuiltinRegistry} from './registry/providers.js';

const argumentsByName = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [name, value = true] = argument.replace(/^--/, '').split('=', 2);
  return [name, value];
}));
const executionMode = argumentsByName['github-actions'] ? 'github-actions' :
  argumentsByName['local-cli'] ? 'local-cli' : 'fixture';
const providerConfig = executionMode === 'local-cli' ? {
  executionMode,
  trailPath: argumentsByName.trail,
} : executionMode === 'github-actions' ? {
  executionMode,
  test: argumentsByName.test || 'checkout',
  browser: 'chromium',
} : {executionMode};
const fixtureUrl = new URL('./test/fixtures/lhr.json', import.meta.url);
const lhr = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const mockTransport = {
  dispatchWorkflow: async () => ({runId: 123456789, runUrl: 'https://github.example/run/123'}),
  getWorkflowRun: async () => ({status: 'queued'}),
  listArtifacts: async () => [],
  downloadArtifact: async () => ({}),
  cancelWorkflow: async () => {},
};
const githubActionsExecutor = executionMode === 'github-actions' ? new GitHubActionsExecutor({
  client: new GitHubActionsClient(mockTransport),
  repository: 'JsonLord/lighthouse',
  workflow: 'test-hub-trailblaze.yml',
}) : undefined;
const registry = createBuiltinRegistry({trailblaze: {githubActionsExecutor}});
const runConfig = {
  schemaVersion: 1,
  providers: [{id: 'trailblaze', enabled: true, config: providerConfig}],
  policy: {continueOnProviderError: true},
};
const report = await new TestHubOrchestrator(registry).run(lhr, runConfig, {runId: 'demo-run'});
process.stdout.write(`${JSON.stringify({
  runConfig,
  executionMode,
  compositeStatus: report.run.status,
  executions: report.executions,
  providers: report.providerResults.map(result => ({
    id: result.providerId,
    execution: result.metrics?.executionMode || executionMode,
    status: result.status,
    summary: result.summary,
    artifacts: result.artifacts?.length || 0,
  })),
}, null, 2)}\n`);
