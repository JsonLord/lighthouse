/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {runProcess} from '../../runtime/process-runner.js';
import {collectTrailblazeArtifacts} from './artifacts.js';
import {detectTrailblaze} from './availability.js';
import {getExecutionMode, validateTrailblazeConfig} from './config.js';
import {TrailblazeGitHubActionsExecutor} from './github-actions-executor.js';
import {silentLogger} from './logger.js';
import {trailblazeManifest} from './manifest.js';
import {normalizeTrailblazeResult} from './normalizer.js';
import {runLocalTrailblaze, runMockTrailblaze} from './runner.js';

/**
 * Dependency injection keeps unit tests independent of the installed CLI while
 * production uses the hardened process runner.
 * @param {{runProcess?: typeof runProcess, logger?: import('./logger.js').ProviderLogger,
 *   githubActionsExecutor?: import('../../execution/github-actions/executor.js').GitHubActionsExecutor}=} dependencies
 * @return {import('../../schema/types.js').TestProvider}
 */
function createTrailblazeProvider(dependencies = {}) {
  const execute = dependencies.runProcess || runProcess;
  const logger = dependencies.logger || silentLogger;
  const remoteExecutor = dependencies.githubActionsExecutor ?
    new TrailblazeGitHubActionsExecutor(dependencies.githubActionsExecutor) : undefined;
  return {
    metadata: () => trailblazeManifest,
    availability: async context => {
      logger({providerId: 'trailblaze', event: 'availability', message: 'checking CLI'});
      const mode = getExecutionMode(context.config);
      const result = mode === 'github-actions' ? {
        available: Boolean(remoteExecutor),
        reason: remoteExecutor ? 'backend-configured' : 'backend-unavailable',
        message: remoteExecutor ? undefined : 'GitHub Actions backend is not configured',
        capabilities: ['web', 'remote-execution'],
        executionMode: mode,
      } : await detectTrailblaze(context.config, {runProcess: execute});
      logger({
        providerId: 'trailblaze',
        event: 'availability-result',
        message: result.available ? 'backend is available' : 'backend is unavailable',
        data: {reason: result.reason, version: result.version},
      });
      return result;
    },
    validateConfig: validateTrailblazeConfig,
    run: async (request, context) => {
      const mode = getExecutionMode(context.config);
      if (mode === 'fixture') return runMockTrailblaze();
      if (mode === 'github-actions') {
        if (!remoteExecutor) throw new Error('GitHub Actions backend is not configured');
        return remoteExecutor.dispatch(context);
      }
      return runLocalTrailblaze(request, context, {runProcess: execute, logger});
    },
    resume: async (executionReference, context) => {
      if (getExecutionMode(context.config) !== 'github-actions' || !remoteExecutor) {
        throw new Error('Provider execution cannot be resumed');
      }
      return remoteExecutor.resume(executionReference);
    },
    normalize: async (rawResult, context) => {
      const result = await normalizeTrailblazeResult(rawResult, context);
      logger({
        providerId: 'trailblaze',
        event: 'normalized',
        message: `normalized ${result.findings.length} failed journey(s)`,
      });
      return result;
    },
    collectArtifacts: async rawResult => {
      const artifacts = await collectTrailblazeArtifacts(rawResult);
      logger({
        providerId: 'trailblaze',
        event: 'artifacts',
        message: `discovered ${artifacts.length} artifact(s)`,
      });
      return artifacts;
    },
  };
}

const trailblazeProvider = createTrailblazeProvider();

export {createTrailblazeProvider, trailblazeProvider};
