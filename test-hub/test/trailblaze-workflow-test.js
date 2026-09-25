/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {TRAILBLAZE_TEST_CATALOG} from '../providers/trailblaze/catalog.js';

const workflowUrl = new URL('../../.github/workflows/test-hub-trailblaze.yml', import.meta.url);

describe('Trailblaze GitHub Actions workflow', () => {
  it('pins provider/runtime versions and emits the artifact contract', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');
    assert.match(workflow, /TRAILBLAZE_VERSION: v2026\.09\.11/);
    assert.match(workflow, /java-version: '17'/);
    assert.match(workflow, /31485b6869bcff33334efc2b5dd989b795bdb38ab308f026850266dc4912b007/);
    assert.match(workflow, /c919155cfcb091d2a70d3cbfa8af0bcefe50a76349cca9b390ee30185015f5f3/);
    assert.match(workflow, /sha256sum --check --strict/);
    assert.match(workflow, /PLAYWRIGHT_VERSION: 1\.59\.0/);
    assert.match(workflow, /test-hub-trailblaze-\$\{\{ inputs\.test_hub_run_id \}\}/);
    assert.match(workflow, /metadata\.json/);
    assert.match(workflow, /summary\.json|RESULT_DIR/);
    assert.doesNotMatch(workflow, /gradlew|assemble|Android SDK/i);
    assert.doesNotMatch(workflow, /uses: actions\/[\w-]+@v\d/);
  });

  it('keeps browser input IDs mapped to a controlled catalog', async () => {
    const workflow = await readFile(workflowUrl, 'utf8');
    assert.deepEqual(Object.keys(TRAILBLAZE_TEST_CATALOG), ['login', 'search', 'checkout']);
    for (const definition of Object.values(TRAILBLAZE_TEST_CATALOG)) {
      assert.match(definition.trail, /^test-hub\/providers\/trailblaze\/trails\//);
      assert.doesNotMatch(definition.trail, /\.\./);
      assert.match(workflow, new RegExp(definition.trail.replaceAll('/', '\\/')));
    }
  });
});
