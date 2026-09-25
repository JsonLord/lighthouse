/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {spawn} from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
const INHERITED_ENV_KEYS = [
  'HOME', 'LANG', 'LC_ALL', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE',
];

/** @param {NodeJS.ProcessEnv} additions */
function createProcessEnvironment(additions = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const environment = {};
  for (const key of INHERITED_ENV_KEYS) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(additions)) {
    if (value !== undefined) environment[key] = String(value);
  }
  return environment;
}

/** @param {Buffer[]} chunks @param {Buffer} chunk @param {{bytes: number, truncated: boolean}} state @param {number} limit */
function captureChunk(chunks, chunk, state, limit) {
  const remaining = Math.max(0, limit - state.bytes);
  if (remaining) chunks.push(chunk.subarray(0, remaining));
  state.bytes += Math.min(chunk.length, remaining);
  if (chunk.length > remaining) state.truncated = true;
}

/**
 * Executes an argument-array command without a shell and always resolves with a
 * structured result, including spawn failures and timeouts.
 * @param {{command: string, args?: string[], cwd?: string, environment?: NodeJS.ProcessEnv,
 *   timeoutMs?: number, outputLimitBytes?: number}} options
 */
function runProcess(options) {
  const args = options.args || [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outputLimitBytes = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT;
  const startedAt = Date.now();

  return new Promise(resolve => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutState = {bytes: 0, truncated: false};
    const stderrState = {bytes: 0, truncated: false};
    let timedOut = false;
    let spawnError;
    let settled = false;
    const child = spawn(options.command, args, {
      cwd: options.cwd,
      env: createProcessEnvironment(options.environment),
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', chunk => {
      captureChunk(stdoutChunks, chunk, stdoutState, outputLimitBytes);
    });
    child.stderr.on('data', chunk => {
      captureChunk(stderrChunks, chunk, stderrState, outputLimitBytes);
    });

    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: options.command,
        args: [...args],
        exitCode,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        durationMs: Date.now() - startedAt,
        timedOut,
        spawnError,
      });
    };

    child.once('error', error => {
      spawnError = {
        code: /** @type {NodeJS.ErrnoException} */ (error).code,
        message: error.message,
      };
    });
    child.once('close', finish);

    /** @param {NodeJS.Signals} signal */
    const terminate = signal => {
      if (child.pid && process.platform !== 'win32') {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          // Fall back to terminating the direct child.
        }
      }
      child.kill(signal);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
      setTimeout(() => {
        if (!settled) terminate('SIGKILL');
      }, 1000).unref();
    }, timeoutMs);
    timer.unref();
  });
}

const PROCESS_DEFAULTS = {
  timeoutMs: DEFAULT_TIMEOUT_MS,
  outputLimitBytes: DEFAULT_OUTPUT_LIMIT,
};

export {createProcessEnvironment, PROCESS_DEFAULTS, runProcess};
