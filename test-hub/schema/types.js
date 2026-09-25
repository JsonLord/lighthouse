/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The declarations in this file document the public Test Hub data contract. They
 * deliberately live outside `types/lh.d.ts`: external providers do not extend
 * the Lighthouse Result (LHR) schema.
 *
 * @typedef {'info'|'low'|'medium'|'high'|'critical'} FindingSeverity
 * @typedef {'json'|'html'|'image'|'video'|'archive'|'log'|'trace'|'other'} ArtifactType
 * @typedef {'passed'|'failed'|'warning'|'error'|'skipped'|'unknown'} TestStatus
 * @typedef {'pending'|'running'|'completed'|'failed'|'partial'} CompositeRunStatus
 * @typedef {'queued'|'running'|'completed'|'failed'|'cancelled'} ProviderExecutionState
 * @typedef {'performance'|'accessibility'|'security'|'journey'|'seo'|'quality'|'other'} ProviderCategory
 * @typedef {'builtin'|'browser'|'fixture'|'github-actions'|'lighthouse-plugin'|'local-cli'|
 *   'docker'|'http-api'|'remote-worker'} ProviderExecution
 * @typedef {'free'|'local'|'bring-your-own-key'|'credits'|'per-run'|'metered'|'subscription'} ProviderPricing
 * @typedef {'network-access'|'browser-control'|'filesystem-read'|'filesystem-write'|'process-execution'|'docker'|'external-api'|'active-security-scan'|'device-control'} ProviderPermission
 *
 * @typedef {{
 *   amount?: number,
 *   currency?: string,
 *   credits?: number,
 *   description?: string,
 * }} CostEstimate
 *
 * @typedef {{
 *   amount?: number,
 *   currency?: string,
 *   credits?: number,
 *   providerId: string,
 * }} CostRecord
 *
 * @typedef {{
 *   id: string,
 *   providerId: string,
 *   type: ArtifactType,
 *   label?: string,
 *   mimeType?: string,
 *   path?: string,
 *   url?: string,
 *   sizeBytes?: number,
 *   metadata?: Record<string, unknown>,
 * }} ArtifactReference
 *
 * @typedef {{
 *   id: string,
 *   providerId: string,
 *   title: string,
 *   description?: string,
 *   severity: FindingSeverity,
 *   category?: string,
 *   location?: {url?: string, selector?: string, source?: string, line?: number, column?: number, step?: string},
 *   recommendation?: string,
 *   evidence?: ArtifactReference[],
 *   metadata?: Record<string, unknown>,
 * }} Finding
 *
 * @typedef {{
 *   providerId: string,
 *   providerVersion?: string,
 *   runId: string,
 *   status: TestStatus,
 *   title: string,
 *   summary?: string,
 *   score?: {value: number, min: number, max: number, unit?: string},
 *   findings: Finding[],
 *   metrics?: Record<string, unknown>,
 *   artifacts?: ArtifactReference[],
 *   rawResult?: unknown,
 *   startedAt?: string,
 *   completedAt?: string,
 *   durationMs?: number,
 *   cost?: CostRecord,
 * }} TestResult
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   version?: string,
 *   category: ProviderCategory,
 *   execution: ProviderExecution,
 *   pricing: ProviderPricing,
 *   homepage?: string,
 *   repository?: string,
 *   license?: string,
 *   capabilities?: string[],
 *   permissions?: ProviderPermission[],
 *   configurable?: boolean,
 * }} ProviderMetadata
 *
 * @typedef {{providerId: string, providerVersion?: string, phase: string, status: 'completed'|'failed', message?: string}} ProvenanceEntry
 * @typedef {{providerId: string, executionMode: string, state: ProviderExecutionState,
 *   testHubRunId?: string, remote?: {provider: string, repository: string, workflow: string,
 *   runId: number, runUrl: string}}} ProviderExecutionReference
 *
 * @typedef {{
 *   schemaVersion: 1,
 *   target: {requestedUrl?: string, finalUrl?: string},
 *   run: {id: string, startedAt: string, completedAt?: string, durationMs?: number, status: CompositeRunStatus},
 *   lighthouse?: {lhr: unknown, version?: string},
 *   providerResults: TestResult[],
 *   findings: Finding[],
 *   artifacts: ArtifactReference[],
 *   executions: ProviderExecutionReference[],
 *   costs?: {records: CostRecord[]},
 *   provenance: ProvenanceEntry[],
 * }} CompositeReport
 *
 * @typedef {{target?: {requestedUrl?: string, finalUrl?: string}, config?: unknown}} TestRunRequest
 * @typedef {{schemaVersion: 1,
 *   providers: Array<{id: string, enabled: boolean, config: Record<string, unknown>}>,
 *   policy?: {continueOnProviderError?: boolean}}} TestHubRunConfig
 * @typedef {{runId: string, providerId: string, config?: unknown}} ProviderContext
 * @typedef {{available: boolean, reason?: string, message?: string, version?: string,
 *   versionStatus?: string, cliPath?: string, platform?: string, capabilities?: string[],
 *   executionMode?: string}} ProviderAvailability
 * @typedef {{valid: boolean, errors?: string[]}} ValidationResult
 *
 * @typedef {{
 *   metadata(): ProviderMetadata,
 *   availability(context: ProviderContext): Promise<ProviderAvailability>,
 *   validateConfig(config: unknown): Promise<ValidationResult>,
 *   estimateCost?: (request: TestRunRequest, config: unknown) => Promise<CostEstimate>,
 *   prepare?: (request: TestRunRequest, context: ProviderContext) => Promise<void>,
 *   run(request: TestRunRequest, context: ProviderContext): Promise<unknown>,
 *   normalize(rawResult: unknown, context: ProviderContext): Promise<TestResult>,
 *   collectArtifacts?: (rawResult: unknown, context: ProviderContext) => Promise<ArtifactReference[]>,
 *   cleanup?: (context: ProviderContext) => Promise<void>,
 *   resume?: (executionReference: ProviderExecutionReference,
 *     context: ProviderContext) => Promise<unknown>,
 * }} TestProvider
 */

export const COMPOSITE_REPORT_SCHEMA_VERSION = 1;
