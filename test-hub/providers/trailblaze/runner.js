/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {readFile} from 'node:fs/promises';

import {runProcess} from '../../runtime/process-runner.js';
import {buildReportCommand, buildRunCommand} from './commands.js';
import {DEFAULT_TRAILBLAZE_TIMEOUT_MS} from './config.js';
import mockResult from './fixtures/web-journeys.json' with {type: 'json'};
import {silentLogger} from './logger.js';
import {createTrailblazeWorkspace} from './workspace.js';

/**
 * Milestone 1 runner. This intentionally does not spawn a process or load code
 * from the Trailblaze repository.
 * @return {Promise<unknown>}
 */
async function runMockTrailblaze() {
  return {
    executionMode: 'fixture',
    resultJson: structuredClone(mockResult),
    reportFiles: [],
  };
}

/** @param {string} runId */
function createTrailblazeTestName(runId) {
  return `test-hub-${runId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`;
}

/**
 * Extracts the session identifier emitted by the pinned CLI. JSON output is
 * preferred; the stable `Session ID:` status line is accepted as a fallback.
 * @param {string} stdout
 */
function extractSessionId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const value = JSON.parse(line);
      if (typeof value.sessionId === 'string' && value.sessionId) return value.sessionId;
    } catch {
      // Not a JSON status line.
    }
    const match = line.match(/\bSession ID:\s*([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  throw new Error('Trailblaze did not report the executed session ID');
}

/**
 * @param {import('../../schema/types.js').TestRunRequest} request
 * @param {import('../../schema/types.js').ProviderContext} context
 * @param {{runProcess?: typeof runProcess, logger?: import('./logger.js').ProviderLogger}=} dependencies
 */
async function runLocalTrailblaze(request, context, dependencies = {}) {
  const execute = dependencies.runProcess || runProcess;
  const logger = dependencies.logger || silentLogger;
  const config = /** @type {Record<string, unknown>} */ (context.config);
  const workspace = await createTrailblazeWorkspace(context.runId, config);
  const timeoutMs = typeof config.timeoutMs === 'number' ?
    config.timeoutMs : DEFAULT_TRAILBLAZE_TIMEOUT_MS;
  const cwd = typeof config.workingDirectory === 'string' ?
    config.workingDirectory : workspace.root;
  logger({providerId: 'trailblaze', event: 'execute', message: 'executing configured web trail'});
  const testName = createTrailblazeTestName(context.runId);
  const execution = await execute({
    command: 'trailblaze',
    args: buildRunCommand({
      trailPath: config.trailPath,
      testName,
    }),
    cwd,
    timeoutMs,
  });
  if (execution.timedOut) throw new Error(`Trailblaze timed out after ${timeoutMs}ms`);
  if (execution.spawnError) {
    throw new Error(`Trailblaze could not start: ${execution.spawnError.message}`);
  }
  if (execution.exitCode !== 0) {
    throw new Error(`Trailblaze exited with code ${execution.exitCode}`);
  }
  const sessionId = extractSessionId(execution.stdout || '');
  logger({
    providerId: 'trailblaze',
    event: 'exit',
    message: 'trail execution completed',
    data: {exitCode: execution.exitCode, durationMs: execution.durationMs},
  });
  const reportExecution = await execute({
    command: 'trailblaze',
    args: buildReportCommand(sessionId, workspace.reportDirectory),
    cwd,
    timeoutMs,
  });
  if (reportExecution.timedOut) throw new Error('Trailblaze JSON report generation timed out');
  if (reportExecution.spawnError || reportExecution.exitCode !== 0) {
    throw new Error('Trailblaze JSON report generation failed');
  }
  let resultJson;
  try {
    resultJson = JSON.parse(await readFile(workspace.resultPath, 'utf8'));
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
      throw new Error('Trailblaze JSON result file was not created');
    }
    throw new Error(`Trailblaze JSON result is malformed: ${error.message}`);
  }
  return {
    executionMode: 'local-cli',
    resultJson,
    sessionId,
    testName,
    sessionDirectory: workspace.sessionDirectory,
    reportDirectory: workspace.reportDirectory,
    resultPath: workspace.resultPath,
    reportFiles: [workspace.resultPath],
    execution: {
      run: execution,
      report: reportExecution,
    },
  };
}

export {createTrailblazeTestName, extractSessionId, runLocalTrailblaze, runMockTrailblaze};
