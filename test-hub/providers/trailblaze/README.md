# Trailblaze provider (Milestone 2)

This controlled provider runs existing **web** trails through a local
[Trailblaze](https://github.com/block/trailblaze) installation. It is not a
Lighthouse plugin: Trailblaze controls a separate browser journey and produces
its own session result, while Lighthouse retains its normal LHR and audit
lifecycle.

## Product execution: GitHub Actions

End users install nothing. The production configuration is JSON-safe and
contains only controlled catalog values:

```json
{
  "executionMode": "github-actions",
  "test": "checkout",
  "browser": "chromium"
}
```

`login`, `search`, and `checkout` map internally to version-controlled trail
paths. Arbitrary paths, repositories, workflow names, executable names, and
command strings are rejected. The trusted backend—not browser JavaScript—owns
GitHub credentials and dispatches `.github/workflows/test-hub-trailblaze.yml`.

Workflow inputs are `test_hub_run_id`, `provider_id`, `test_id`, and `browser`.
The workflow runs on `ubuntu-latest`, sets up Java 17, restores pinned runtime
caches, downloads Trailblaze `v2026.09.11`, installs cached Chromium, executes
the selected recorded trail, and uploads one correlated artifact. No Gradle or
Android source build occurs in normal runs.

The artifact is named `test-hub-trailblaze-<test-hub-run-id>` and contains
`metadata.json`, `summary.json`, and `report-interactive.html`. Metadata
validation binds it to the expected run, provider, and workflow before import.
The HTML reference is returned to the browser for local viewing.

## Developer execution: local CLI

This advanced backend is only for development, troubleshooting, integration
tests, and self-hosted environments. It is not the product default.

### Prerequisites and version policy

Install Trailblaze using its upstream installation instructions and ensure the
`trailblaze` executable is on the sanitized child-process `PATH`. This adapter
supports exactly `v2026.09.11`; older versions are unsupported and newer date
releases remain untested until the contract fixtures are deliberately updated. It is web-only; mobile
devices, Android, iOS, simulators, and trail authoring are intentionally out of
scope.

The adapter uses only this fixed CLI contract:

```sh
trailblaze --version
trailblaze device list
trailblaze run --device web --no-daemon --test-name test-hub-<run-id> \
  /absolute/trail/path
trailblaze report --id <session-id> --output-dir /isolated/report
```

`device list` is a human-readable diagnostic and is not parsed or used as an
availability gate. The run command executes an existing trail and emits the
session ID assigned to that invocation. The provider supplies a unique test
name and requires that emitted ID before generating a report; it never assumes
the latest global session. The report command generates canonical
`summary.json` and `report-interactive.html` output. User configuration cannot
replace the executable or subcommands.

## Configuration

Fixture mode remains the default and needs no installation:

```js
{executionMode: 'fixture'}
```

Real execution must be explicit:

```js
{
  executionMode: 'local-cli',
  trailPath: '/absolute/path/to/checkout.trail',
  timeoutMs: 600000,
  // Optional existing cwd and persistent artifact root:
  workingDirectory: '/absolute/existing/directory',
  artifactDirectory: '/absolute/output/directory',
}
```

The selected trail/workspace owns Web target resolution. There is no
`targetUrl` provider setting and Test Hub does not assume the Lighthouse page
URL is the Trailblaze target. Configure the target through the trail and its
normal Trailblaze workspace configuration before invoking Test Hub.

Output is written below `.tmp/test-hub/<run-id>/trailblaze` by default. An
`artifactDirectory` changes the parent but the provider still appends
`<run-id>/trailblaze` to preserve run isolation. Referenced output is retained;
automatic deletion is deferred until report retention rules exist.

## Safety and failure semantics

Commands use argument arrays with no shell. The reusable process runner
sanitizes inherited environment variables, bounds stdout/stderr to 1 MiB each,
defaults provider execution to ten minutes, and terminates the owned process
group on timeout. Captured output is not logged by default. Only absolute,
readable trail files are accepted. The provider always selects `--no-daemon` so
each isolated invocation owns its process/browser lifecycle and cannot leave a
shared daemon running or create cross-run daemon state.

A completed CLI invocation with a failing journey yields a failed
`TestResult` in a **completed** composite report. Missing/unsupported CLI,
timeout, process failure, report failure, missing JSON, or malformed JSON is an
infrastructure error and yields a **partial** composite report. Optional
unavailable providers consistently use the latter rule.

For GitHub Actions, workflow infrastructure state is recorded independently as
`queued`, `running`, `completed`, `failed`, or `cancelled`. A `completed`
workflow with a failed Trailblaze summary produces a failed `TestResult` and a
completed composite report. Workflow failure produces an error result and a
partial composite report.

## Results and artifacts

The pinned release's `CiSummaryReport`/`SessionResult` `summary.json` document is
retained unchanged as `TestResult.rawResult`. Overall status and failed steps
are normalized without creating a numeric score; unknown additional fields are
preserved and ignored by normalization.
Artifact discovery recursively confirms regular files before returning
references. Recognized output includes JSON, standalone/interactive HTML,
PNG/JPEG/WebP screenshots or timelines, ZIP session archives, logs, and trace,
timeline, or storyboard files. The Test Hub links to Trailblaze HTML/trace
artifacts and does not recreate its detailed viewer.

Unit tests use fixture mode or injected subprocess results and never require or
install Trailblaze. `node test-hub/demo.js` demonstrates fixture mode. With a
mock backend dispatch, `node test-hub/demo.js --github-actions --test=checkout`
demonstrates the asynchronous production shape. With a compatible local
installation, use:

```sh
node test-hub/demo.js --local-cli \
  --trail=/absolute/path/to/trail
```
