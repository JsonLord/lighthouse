/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export {createCompositeReportFromLhr} from './lighthouse-adapter.js';
export {assertTestHubRunConfig, validateTestHubRunConfig} from './config/run-config.js';
export {GitHubActionsClient} from './execution/github-actions/client.js';
export {GitHubActionsExecutor} from './execution/github-actions/executor.js';
export {TestHubOrchestrator} from './orchestrator/orchestrator.js';
export {assertTestProvider} from './provider.js';
export {ProviderRegistry} from './registry/provider-registry.js';
export {createBuiltinRegistry} from './registry/providers.js';
export {createProcessEnvironment, PROCESS_DEFAULTS, runProcess} from './runtime/process-runner.js';
export {
  validateArtifactReference,
  validateCompositeReport,
  validateFinding,
  validateTestResult,
} from './schema/validation.js';
export {COMPOSITE_REPORT_SCHEMA_VERSION} from './schema/types.js';
