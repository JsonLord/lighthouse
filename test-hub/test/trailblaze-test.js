/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {collectTrailblazeArtifacts} from '../providers/trailblaze/artifacts.js';
import pinnedSummary from '../providers/trailblaze/fixtures/trailblaze-v2026.09.11-summary.json'
  with {type: 'json'};
import {normalizeTrailblazeResult} from '../providers/trailblaze/normalizer.js';
import {
  createTrailblazeTestName,
  extractSessionId,
  runLocalTrailblaze,
  runMockTrailblaze,
} from '../providers/trailblaze/runner.js';

const context = {runId: 'run', providerId: 'trailblaze'};

describe('Trailblaze execution and normalization', () => {
  it('normalizes several fixture journeys and preserves raw JSON', async () => {
    const raw = await runMockTrailblaze();
    const result = await normalizeTrailblazeResult(raw, context);
    assert.equal(result.status, 'failed');
    assert.equal(result.summary, '2 passed, 1 failed');
    assert.equal(result.score, undefined);
    assert.equal(result.findings[0].location?.step, 'Submit order');
    assert.equal(result.rawResult, raw.resultJson);
  });

  it('normalizes a passing journey', async () => {
    const raw = {executionMode: 'local-cli', resultJson: {
      testName: 'Login trail', status: 'PASSED',
      steps: [{name: 'Log in', status: 'PASSED'}], customField: 'preserved',
    }};
    const result = await normalizeTrailblazeResult(raw, context);
    assert.equal(result.status, 'passed');
    assert.equal(result.rawResult.customField, 'preserved');
  });

  it('normalizes the pinned CiSummaryReport fixture', async () => {
    const result = await normalizeTrailblazeResult({
      executionMode: 'local-cli', resultJson: pinnedSummary,
    }, context);
    assert.equal(result.title, 'Test Hub checkout smoke');
    assert.equal(result.status, 'failed');
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].location?.step, 'Test Hub checkout smoke');
    assert.equal(result.rawResult, pinnedSummary);
    assert.equal(result.score, undefined);
  });

  it('maps a unique test name and emitted session ID deterministically', () => {
    assert.equal(createTrailblazeTestName('run:123'), 'test-hub-run_123');
    assert.equal(extractSessionId('{"sessionId":"session-json"}\n'), 'session-json');
    assert.equal(extractSessionId('Completed\nSession ID: session-text\n'), 'session-text');
    assert.equal(extractSessionId(
      'Trace posted to server for session test_hub_checkout_908161c6\n'),
    'test_hub_checkout_908161c6');
    assert.throws(() => extractSessionId('completed without identity'), /session ID/);
  });

  it('rejects malformed JSON shapes', async () => {
    await assert.rejects(normalizeTrailblazeResult({resultJson: {}}, context), /Malformed/);
  });

  it('executes a trail then ingests the generated JSON report', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'trailblaze-run-'));
    const config = {
      executionMode: 'local-cli', trailPath: path.join(directory, 'test.trail'),
      artifactDirectory: path.join(directory, 'out'),
    };
    await writeFile(config.trailPath, 'trail');
    const calls = [];
    const execute = async options => {
      calls.push(options);
      if (options.args[0] === 'report') {
        await writeFile(path.join(options.args.at(-1), 'summary.json'),
          JSON.stringify({testName: 'Checkout', status: 'FAILED', steps: []}));
      }
      return {exitCode: 0, stdout: 'Session ID: session-123\n', stderr: '',
        durationMs: 1, timedOut: false};
    };
    const raw = await runLocalTrailblaze({}, {...context, config}, {runProcess: execute});
    assert.equal(raw.resultJson.status, 'FAILED');
    assert.equal(raw.sessionId, 'session-123');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].args, [
      'run', '--device', 'web', '--no-daemon', '--test-name', 'test-hub-run', config.trailPath,
    ]);
    assert.deepEqual(calls[1].args.slice(0, 3), ['report', '--id', 'session-123']);
  });

  it('surfaces subprocess failures and timeouts', async () => {
    const config = {executionMode: 'local-cli', trailPath: '/trail',
      artifactDirectory: await mkdtemp('/tmp/tb-fail-')};
    await assert.rejects(runLocalTrailblaze({}, {...context, config}, {
      runProcess: async () => ({exitCode: 9, timedOut: false}),
    }), /exited with code 9/);
    await assert.rejects(runLocalTrailblaze({}, {...context, config}, {
      runProcess: async () => ({exitCode: null, timedOut: true}),
    }), /timed out/);
  });

  it('generates and trusts a report when a failed journey exits nonzero', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'tb-journey-fail-'));
    const config = {executionMode: 'local-cli', trailPath: '/trail',
      artifactDirectory: directory};
    let calls = 0;
    const raw = await runLocalTrailblaze({}, {...context, config}, {
      runProcess: async options => {
        calls++;
        if (calls === 1) {
          return {exitCode: 1, timedOut: false,
            stdout: 'Trace posted to server for session failed_session\n'};
        }
        await writeFile(path.join(options.args.at(-1), 'summary.json'), JSON.stringify({
          results: [{title: 'Failed journey', outcome: 'FAILED',
            failure_reason: 'Expected confirmation was absent'}],
        }));
        return {exitCode: 0, timedOut: false, stdout: ''};
      },
    });
    const result = await normalizeTrailblazeResult(raw, context);
    assert.equal(result.status, 'failed');
    assert.equal(raw.execution.run.exitCode, 1);
    assert.equal(calls, 2);
  });

  it('rejects missing and malformed result files', async () => {
    for (const malformed of [false, true]) {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'tb-result-'));
      const config = {executionMode: 'local-cli', trailPath: '/trail',
        artifactDirectory: directory};
      let calls = 0;
      const promise = runLocalTrailblaze({}, {...context, config}, {runProcess: async options => {
        calls++;
        if (calls === 2 && malformed) {
          await writeFile(path.join(options.args.at(-1), 'summary.json'), '{');
        }
        return {exitCode: 0, stdout: 'Session ID: session-123', timedOut: false};
      }});
      await assert.rejects(promise, malformed ? /malformed/ : /was not created/);
    }
  });

  it('discovers only artifacts that exist', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'tb-artifacts-'));
    await mkdir(path.join(directory, 'screenshots'));
    await writeFile(path.join(directory, 'trace.html'), '<html>');
    await writeFile(path.join(directory, 'screenshots', 'step.webp'), 'image');
    const artifacts = await collectTrailblazeArtifacts({
      executionMode: 'local-cli', sessionDirectory: directory,
      resultPath: path.join(directory, 'missing.json'),
    });
    assert.equal(artifacts.length, 2);
    assert.deepEqual(artifacts.map(item => item.type).sort(), ['html', 'image']);
  });
});
