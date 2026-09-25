# Test Hub architecture

The Test Hub is an additive orchestration and reporting layer around Lighthouse.
Lighthouse still runs normally and produces an unchanged Lighthouse Result
(LHR). The hub accepts that completed LHR, runs explicitly enabled external
providers, and emits a separately versioned `CompositeReport`. Existing
Lighthouse CLI and report-renderer paths are not involved.

## Lighthouse plugins versus Test Providers

| | Native Lighthouse plugin | External Test Provider |
|---|---|---|
| Execution | Inside Lighthouse gathering/auditing | Beside Lighthouse, after an LHR exists |
| Output | Lighthouse audits and categories in the LHR | A normalized `TestResult` in a `CompositeReport` |
| Scoring | Lighthouse audit/category conventions | Score is optional; no universal score |
| Extension point | Lighthouse configuration/plugin API | Controlled Test Hub registry and lifecycle |

Providers must not be forced into the Lighthouse `Audit` interface. This keeps
external failures and result formats from changing Lighthouse internals.

## CompositeReport

Schema version 1 stores target and run metadata, the original LHR, normalized
provider results, aggregated findings, artifact references, optional cost
records, and provenance. The adapter retains the exact LHR object without
mutating it. Artifacts are references rather than embedded binary data.

If Lighthouse has succeeded but any external lifecycle phase fails, the hub
adds an error result and failed provenance entry and marks the composite run
`partial`. One provider failure does not prevent later providers from running.

## Provider lifecycle

The orchestrator processes enabled providers from the controlled registry in
this order:

1. `availability(context)`
2. `validateConfig(config)`
3. optional `prepare(request, context)`
4. `run(request, context)`
5. `normalize(rawResult, context)`
6. optional `collectArtifacts(rawResult, context)`
7. optional `cleanup(context)`, even after failure

Activation is currently in memory. Availability, configuration,
execution, normalization, artifact, and cleanup errors are isolated and
recorded as provenance. Raw provider output may be retained in `TestResult`;
large artifacts must remain external references.

Provider discovery, activation, and run participation are separate. The static
registry says which providers exist. Activation is product state for the future
Test Shop. A versioned, JSON-only `TestHubRunConfig` says which enabled entries
participate in one run; the orchestrator never treats registry activation as a
request to execute. Disabled run entries are ignored.

Remote providers are asynchronous. Initial orchestration dispatches work and
returns a composite report with `run.status: "running"` and a safe execution
reference in `executions`. A later `resume()` poll imports completed artifacts,
normalizes results, and transitions the composite to `completed` or `partial`.
Workflow state (`queued`, `running`, `completed`, `failed`, or `cancelled`) is
separate from the provider verdict. A completed Trailblaze workflow may produce
a failed journey without becoming an infrastructure failure.

## Adding a future provider

Implement the `TestProvider` contract documented in
`test-hub/schema/types.js`, declare metadata including execution mode, pricing,
capabilities, and permissions, and register a trusted instance in
`test-hub/registry/providers.js`. Keep execution, normalization, and artifact
collection separate. Normalizers must return schema-valid results but need not
invent a numeric score.

Provider code is loaded only from the static registry. The Test Hub does not
download or execute arbitrary GitHub code, persist activation, store API keys,
or render a Test Shop UI.

## Local provider process security

Local providers share a reusable process runner that never invokes a shell,
accepts argument arrays, inherits only a small allowlist of environment
variables, bounds stdout and stderr, enforces timeouts, and terminates the owned
process group. Provider configuration cannot override the Trailblaze executable
or its fixed subcommands. Trailblaze output is isolated under
`.tmp/test-hub/<run-id>/trailblaze` by default.

Trailblaze supports fixture and explicitly selected `local-cli` backends. The
local backend validates an existing absolute trail path, requires exactly
Trailblaze `v2026.09.11`, executes it with `run --device web --no-daemon` and a
unique test name, captures the emitted session ID, and generates that session's
report with `report --id <session-id> --output-dir <directory>`. The trail and
its Trailblaze workspace resolve the Web target; the Lighthouse URL is not
passed as a Trailblaze target. The unchanged canonical `summary.json` becomes
`rawResult`; confirmed session files become artifact references. See the
[provider README](../test-hub/providers/trailblaze/README.md) for exact commands,
configuration, version policy, timeout behavior, and supported artifacts.

An assertion failure inside a successfully executed trail is a normal failed
`TestResult`, so the composite run remains `completed`. CLI unavailability,
timeouts, process errors, and invalid/missing result JSON are provider
infrastructure failures, so an otherwise successful Lighthouse composite run is
`partial`.

## GitHub Actions execution

Trailblaze's product backend is GitHub Actions; browser users install nothing.
The browser submits a `TestHubRunConfig` containing only controlled values such
as `{executionMode: "github-actions", test: "checkout", browser: "chromium"}`
to a trusted backend. That backend owns the GitHub App or token and injects a
`GitHubActionsClient`; credentials are never accepted in run configuration or
stored in `CompositeReport`.

The reusable executor supports dispatch, one-shot status polling, artifact
import, and cancellation. Trailblaze dispatch inputs are limited to
`test_hub_run_id`, `provider_id`, `test_id`, and `browser`. Test IDs map through
a controlled catalog to version-controlled trails, so clients cannot provide
paths, repositories, workflow names, or shell commands.

Each successful workflow uploads
`test-hub-trailblaze-<test-hub-run-id>` containing `metadata.json`,
`summary.json`, and `report-interactive.html`. Import validates schema version,
run ID, provider ID, and workflow before normalization. Safe backend URLs for
the interactive report can be surfaced in the browser; Test Hub does not
reimplement Trailblaze's viewer.

## Development demonstration

Run `node test-hub/demo.js` for a fixture-backed summary. If Trailblaze is
installed, run `node test-hub/demo.js --local-cli
--trail=/absolute/trail/path` for the real local backend. Output names the
selected backend explicitly.
