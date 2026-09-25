/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

import {runProcess} from '../runtime/process-runner.js';

describe('process runner', () => {
  it('captures successful output', async () => {
    const result = await runProcess({command: process.execPath, args: ['-e', 'console.log("ok")']});
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, 'ok\n');
    assert.equal(result.timedOut, false);
  });

  it('returns non-zero exits and stderr', async () => {
    const result = await runProcess({
      command: process.execPath,
      args: ['-e', 'console.error("bad"); process.exit(7)'],
    });
    assert.equal(result.exitCode, 7);
    assert.equal(result.stderr, 'bad\n');
  });

  it('terminates timed-out process groups', async () => {
    const result = await runProcess({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 50,
    });
    assert.equal(result.timedOut, true);
    assert.equal(result.signal, 'SIGTERM');
  });

  it('structures invalid executable errors', async () => {
    const result = await runProcess({command: 'definitely-not-a-real-test-hub-executable'});
    assert.equal(result.spawnError.code, 'ENOENT');
    assert.equal(result.exitCode, -2);
  });

  it('bounds captured output', async () => {
    const result = await runProcess({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("x".repeat(100))'],
      outputLimitBytes: 10,
    });
    assert.equal(result.stdout, 'xxxxxxxxxx');
    assert.equal(result.stdoutTruncated, true);
  });
});
