# Lighthouse Test Hub Transformation Specification

## 1. Project

Repository:

`https://github.com/JsonLord/lighthouse.git`

Base project:

Google Lighthouse fork, currently based on Lighthouse 13.5.x.

Goal:

Transform the fork from a single-engine Lighthouse audit application into a modular **Web Test Hub** that keeps Lighthouse as the core audit engine while allowing users to activate additional test providers from a **Test Shop**.

The Test Shop must support:

- native Lighthouse plugins
- local CLI-based tools
- Docker/container-backed tools
- GitHub-hosted open-source test providers
- hosted API providers
- free providers
- bring-your-own-key providers
- metered or paid-per-run providers

The first external reference provider will be:

`https://github.com/block/trailblaze.git`

Trailblaze must eventually be able to contribute web user-journey test results and artifacts to the unified Lighthouse-derived report.

---

# 2. Core Architectural Principle

Do **not** rewrite Lighthouse into a generic test framework.

Preserve the existing Lighthouse runtime and Lighthouse Result (LHR) model as much as possible.

Instead, introduce a new orchestration and reporting layer around Lighthouse:

```text
Lighthouse
    |
    v
Original LHR
    |
    +------------------------------+
                                   |
External Providers                 |
    |                              |
    v                              v
Normalized TestResult ------> CompositeReport
                                   |
                                   v
                         Unified Report Renderer
```

The new system should treat Lighthouse as one provider among several at the orchestration/report level, while still retaining its current internals.

This separation is critical for:

- keeping upstream Lighthouse merges manageable
- preventing third-party tools from polluting Lighthouse core types
- supporting non-Lighthouse result formats
- supporting tests that execute outside Chrome/Lighthouse
- enabling paid or remote API tests
- isolating untrusted or semi-trusted provider execution

---

# 3. Non-Goals for the First Implementation

The first implementation must **not** attempt all of the following at once:

- full payment processing
- marketplace publishing by third parties
- automatic execution of arbitrary GitHub repositories
- Android or iOS Trailblaze execution
- full OAuth account system
- usage billing
- multi-tenant SaaS infrastructure
- arbitrary Docker execution
- cloud worker orchestration
- rewriting the existing Lighthouse report renderer

The first implementation should establish the extensible architecture needed for these later capabilities.

---

# 4. Existing Lighthouse Concepts to Preserve

The existing Lighthouse repository already contains:

- core audit engine
- report renderer
- report generator
- Lighthouse plugin support
- plugin category validation
- native Lighthouse Result schema
- CLI
- viewer

These concepts should remain functional.

Native Lighthouse plugins remain a distinct extension mechanism.

They should **not** be replaced by the new Test Provider system.

Two extension classes therefore exist:

```text
Native Lighthouse Plugin
    -> runs inside Lighthouse
    -> contributes Lighthouse audits/categories
    -> becomes part of the LHR

External Test Provider
    -> executes beside Lighthouse
    -> returns normalized TestResult
    -> becomes part of CompositeReport
```

---

# 5. New Top-Level Concept: CompositeReport

Create a new versioned report model.

Suggested location:

```text
test-hub/schema/composite-report.js
```

or TypeScript if introducing TS in the new module is consistent with the current repository build.

The CompositeReport must contain the original LHR without mutating it.

Example conceptual structure:

```ts
interface CompositeReport {
  schemaVersion: number;

  target: {
    requestedUrl?: string;
    finalUrl?: string;
  };

  run: {
    id: string;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  };

  lighthouse?: {
    lhr: unknown;
    version?: string;
  };

  providerResults: TestResult[];

  findings: Finding[];

  artifacts: ArtifactReference[];

  costs?: CostSummary;

  provenance: ProvenanceEntry[];
}
```

Requirements:

1. Original LHR must remain structurally unchanged.
2. Existing Lighthouse-only reports must still render.
3. CompositeReport should support partial provider failure.
4. Each external provider result must preserve its raw result or an artifact reference.
5. CompositeReport must be explicitly versioned.

---

# 6. Normalized TestResult Schema

Create a normalized result type used by all external providers.

Conceptual structure:

```ts
interface TestResult {
  providerId: string;
  providerVersion?: string;

  runId: string;

  status:
    | 'passed'
    | 'failed'
    | 'warning'
    | 'error'
    | 'skipped'
    | 'unknown';

  title: string;
  summary?: string;

  score?: {
    value: number;
    min: number;
    max: number;
    unit?: string;
  };

  findings: Finding[];

  metrics?: Record<string, unknown>;

  artifacts?: ArtifactReference[];

  rawResult?: unknown;

  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  cost?: CostRecord;
}
```

Important:

Do not require every provider to produce a numeric score.

Pass/fail tools, security scanners, journey tests, accessibility APIs, and performance tools may use fundamentally different scoring models.

---

# 7. Finding Schema

Create a shared finding format:

```ts
interface Finding {
  id: string;
  providerId: string;

  title: string;
  description?: string;

  severity:
    | 'info'
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

  category?: string;

  location?: {
    url?: string;
    selector?: string;
    source?: string;
    line?: number;
    column?: number;
    step?: string;
  };

  recommendation?: string;

  evidence?: ArtifactReference[];

  metadata?: Record<string, unknown>;
}
```

The unified report must later be able to aggregate findings from multiple providers.

---

# 8. Artifact Model

External providers may produce:

- JSON
- HTML
- screenshots
- videos
- archives
- logs
- traces
- timelines
- downloadable reports

Define an artifact abstraction:

```ts
interface ArtifactReference {
  id: string;
  providerId: string;

  type:
    | 'json'
    | 'html'
    | 'image'
    | 'video'
    | 'archive'
    | 'log'
    | 'trace'
    | 'other';

  label?: string;
  mimeType?: string;

  path?: string;
  url?: string;

  sizeBytes?: number;

  metadata?: Record<string, unknown>;
}
```

Do not embed large binary evidence directly in CompositeReport.

Use references.

---

# 9. Provider System

Create a new provider subsystem.

Suggested structure:

```text
test-hub/
├── schema/
├── registry/
├── orchestrator/
├── providers/
├── artifacts/
└── security/
```

Provider interface:

```ts
interface TestProvider {
  metadata(): ProviderMetadata;

  availability(context: ProviderContext): Promise<ProviderAvailability>;

  validateConfig(config: unknown): Promise<ValidationResult>;

  estimateCost?(
    request: TestRunRequest,
    config: unknown
  ): Promise<CostEstimate>;

  prepare?(
    request: TestRunRequest,
    context: ProviderContext
  ): Promise<void>;

  run(
    request: TestRunRequest,
    context: ProviderContext
  ): Promise<ProviderRawResult>;

  normalize(
    rawResult: ProviderRawResult,
    context: ProviderContext
  ): Promise<TestResult>;

  collectArtifacts?(
    rawResult: ProviderRawResult,
    context: ProviderContext
  ): Promise<ArtifactReference[]>;

  cleanup?(context: ProviderContext): Promise<void>;
}
```

Providers must be loaded from a controlled registry.

No arbitrary dynamic code loading from remote repositories in the first implementation.

---

# 10. Provider Metadata

Every provider requires metadata.

Conceptual model:

```ts
interface ProviderMetadata {
  id: string;
  name: string;
  description: string;

  version?: string;

  category:
    | 'performance'
    | 'accessibility'
    | 'security'
    | 'journey'
    | 'seo'
    | 'quality'
    | 'other';

  execution:
    | 'builtin'
    | 'lighthouse-plugin'
    | 'local-cli'
    | 'docker'
    | 'http-api'
    | 'remote-worker';

  pricing:
    | 'free'
    | 'local'
    | 'bring-your-own-key'
    | 'credits'
    | 'per-run'
    | 'metered'
    | 'subscription';

  homepage?: string;
  repository?: string;
  license?: string;

  capabilities?: string[];

  permissions?: ProviderPermission[];

  configurable?: boolean;
}
```

---

# 11. Provider Permissions

Providers may perform actions with different risk levels.

Create explicit permission metadata such as:

```text
network-access
browser-control
filesystem-read
filesystem-write
process-execution
docker
external-api
active-security-scan
device-control
```

The Test Shop must eventually display required permissions before activation.

Providers performing intrusive security scanning must require explicit authorization from the user.

---

# 12. Provider Registry

Create a static built-in registry first.

Example:

```text
test-hub/registry/providers.js
```

Initial entries:

```text
lighthouse
trailblaze
```

Later:

```text
zap
wave
webpagetest
checkly
browserstack
```

The registry should support:

```ts
getProvider(id)
listProviders()
listEnabledProviders()
enableProvider(id)
disableProvider(id)
```

Persistent activation settings may be added later.

For the first milestone, in-memory or local configuration is sufficient.

---

# 13. Test Shop UI

Add a new Test Shop surface without replacing the Lighthouse report.

Suggested navigation:

```text
Overview
Lighthouse
Test Shop
Runs
Settings
```

Initial Test Shop requirements:

- list provider cards
- category filter
- free/paid badge
- execution type
- provider source/repository
- activation state
- permissions summary
- Configure action
- Activate / Disable action

Example card:

```text
Trailblaze
User Journey Testing
FREE

Natural-language journeys with deterministic replay.

Platforms:
Web
Android
iOS

Execution:
Local CLI

Source:
block/trailblaze

[Details] [Activate]
```

The first UI implementation can use static provider registry data.

It does not need account billing.

---

# 14. My Tests

Enabled providers should appear in a simple "My Tests" or enabled-provider view.

Each enabled provider should expose:

```text
Enabled
Configuration status
Availability status
Run eligibility
Last result
Disable
```

The user should eventually be able to choose which enabled tests participate in a run.

---

# 15. Orchestrator

Introduce a Test Orchestrator.

Conceptual sequence:

```text
create run
   |
   +-> Lighthouse
   |
   +-> enabled provider A
   |
   +-> enabled provider B
   |
collect results
   |
normalize provider results
   |
aggregate findings
   |
build CompositeReport
```

Initial implementation may run providers sequentially.

Later the orchestrator may support concurrency.

Critical requirement:

A provider failure should not necessarily invalidate the entire run.

Example:

```text
Lighthouse: completed
Trailblaze: failed to start
CompositeReport: partial
```

---

# 16. Lighthouse Provider Adapter

Treat Lighthouse as a special built-in provider at the CompositeReport level.

Do not route the existing Lighthouse runner through the generic external provider API unless that can be done with minimal disruption.

Instead create a lightweight adapter that takes an existing LHR and attaches it to CompositeReport.

Example:

```text
run Lighthouse normally
        |
        v
      LHR
        |
        v
create CompositeReport
        |
        + lighthouse.lhr = LHR
```

This minimizes changes in `core/`.

---

# 17. Trailblaze Reference Provider

Repository:

`https://github.com/block/trailblaze.git`

Trailblaze should become the first external provider.

Initial scope:

**Web only.**

Do not implement Android or iOS initially.

The adapter should eventually:

1. detect whether the `trailblaze` CLI is installed
2. expose installation instructions if unavailable
3. validate the configured web test target
4. run selected Trailblaze web trails
5. generate or locate JSON result output
6. ingest Trailblaze `SessionResult` / summary data
7. normalize results into TestResult
8. attach report artifacts
9. expose links/references to rich Trailblaze evidence

Trailblaze already supports report artifacts such as:

```text
JSON result
session.zip
standalone HTML
screenshots
timeline
storyboard
```

The unified Lighthouse report should not attempt to duplicate Trailblaze's full trace viewer.

Instead display:

```text
Trailblaze

Checkout Journey     PASS
Login Journey        PASS
Search Journey       FAIL

[View findings]
[Open trace]
[View screenshots]
```

Detailed traces remain Trailblaze artifacts.

---

# 18. Trailblaze Adapter Layout

Suggested:

```text
test-hub/providers/trailblaze/
├── provider.js
├── manifest.js
├── runner.js
├── normalizer.js
├── artifacts.js
└── README.md
```

Responsibilities:

## provider.js

Implements TestProvider.

## runner.js

Responsible only for CLI execution.

No result normalization.

## normalizer.js

Maps Trailblaze output into TestResult and Finding.

## artifacts.js

Discovers and registers Trailblaze report artifacts.

## manifest.js

Contains ProviderMetadata.

---

# 19. GitHub-Based Provider Imports

The long-term Test Shop should allow provider installation from GitHub.

Do **not** execute arbitrary repositories directly.

Introduce a provider manifest format.

Suggested filename:

```text
test-provider.json
```

Concept:

```json
{
  "schemaVersion": 1,
  "id": "trailblaze",
  "name": "Trailblaze",
  "repository": "https://github.com/block/trailblaze",
  "license": "Apache-2.0",

  "runner": {
    "type": "local-cli",
    "command": "trailblaze"
  },

  "pricing": {
    "type": "free"
  },

  "capabilities": [
    "web",
    "journey-testing",
    "screenshots",
    "trace"
  ],

  "permissions": [
    "browser-control",
    "network-access",
    "process-execution"
  ]
}
```

Future GitHub import flow:

```text
repository URL
      |
fetch manifest
      |
validate schema
      |
inspect permissions
      |
show activation screen
      |
pin version/commit
      |
install adapter or provider package
```

Do not implement arbitrary remote repository execution in the initial milestone.

---

# 20. Paid Provider Architecture

Paid providers should use server-side credentials.

Never embed provider API keys into generated Lighthouse HTML reports.

Future API-oriented providers may require:

```text
WAVE_API_KEY
WEBPAGETEST_API_KEY
CHECKLY_API_KEY
BROWSERSTACK_USERNAME
BROWSERSTACK_ACCESS_KEY
```

Future server API:

```text
POST /api/runs
GET  /api/runs/:id
POST /api/runs/:id/cancel

GET  /api/catalog

POST /api/providers/:id/quote
POST /api/providers/:id/run
```

The first milestone only needs architecture that does not make this impossible later.

Do not implement payment processing yet.

---

# 21. Cost Model

Create optional shared types now:

```ts
interface CostEstimate {
  amount?: number;
  currency?: string;
  credits?: number;
  description?: string;
}

interface CostRecord {
  amount?: number;
  currency?: string;
  credits?: number;
  providerId: string;
}
```

Providers may omit cost entirely.

---

# 22. Report Integration

Do not rewrite the existing report renderer in the first milestone.

Introduce a wrapper/host view that can render:

```text
Composite Report

[Overview]
[Lighthouse]
[Additional Tests]
[All Findings]
[Artifacts]
```

The Lighthouse tab should continue using the existing Lighthouse report renderer.

External tests should use new UI components.

A first working report may look like:

```text
WEBSITE HEALTH

Lighthouse
Performance       92
Accessibility     88
SEO               91

Additional Tests

Trailblaze
Checkout          PASS
Login             PASS
Search            FAIL
```

---

# 23. All Findings View

CompositeReport should aggregate findings from all provider results.

Create a normalized table later:

```text
Severity
Provider
Category
Finding
Location
Evidence
```

Filters:

```text
provider
severity
category
status
```

This view is an important reason to normalize results.

---

# 24. Backward Compatibility

This is mandatory.

Existing workflows should continue working:

```text
lighthouse URL
lighthouse URL --output html
lighthouse URL --output json
```

Existing LHR JSON must remain usable.

Existing standalone report HTML must remain usable.

The new Test Hub mode should be additive.

Possible activation mechanisms:

```text
--test-hub
```

or:

```text
--extra-tests
```

or configuration.

Exact CLI naming can be decided during implementation.

---

# 25. Upstream Maintainability

Minimize edits in:

```text
core/
shared/
report/renderer/
```

Prefer new code under:

```text
test-hub/
```

and thin integration hooks.

The project should remain reasonably mergeable with upstream Lighthouse.

If a requirement can be implemented either by modifying a large upstream file or through an adapter/wrapper, prefer the adapter/wrapper.

---

# 26. Security Requirements

External providers are potentially dangerous.

Never silently execute downloaded code.

Future community providers must be version-pinned.

Provider permissions must be explicit.

Potential future sandbox strategies:

```text
subprocess isolation
container
restricted working directory
network policies
timeout
memory limits
CPU limits
artifact size limits
```

At minimum, the first provider runner should support:

```text
execution timeout
captured stdout
captured stderr
exit code
working directory isolation
clean failure handling
```

---

# 27. Logging

Introduce provider-aware logs.

Example:

```text
[test-hub] run created: abc123
[lighthouse] starting
[lighthouse] completed
[trailblaze] checking availability
[trailblaze] running checkout trail
[trailblaze] completed
[test-hub] composite report completed
```

Do not mix provider logs directly into Lighthouse audit output if avoidable.

---

# 28. Testing Requirements

Add tests for the new architecture.

Minimum tests:

## Schema

- valid CompositeReport
- partial CompositeReport
- provider result without score
- finding severity validation
- artifact references

## Registry

- list provider
- get provider
- unknown provider
- enable/disable provider

## Orchestrator

- Lighthouse-only run
- Lighthouse + successful provider
- provider failure produces partial report
- normalization failure does not corrupt LHR

## Trailblaze

Mock CLI execution.

Test:

- unavailable CLI
- successful result
- failed CLI process
- malformed JSON
- artifact discovery
- normalization

Do not require actual Trailblaze installation in unit tests.

---

# 29. First Development Milestone

The first milestone is **architecture only plus a mocked Trailblaze provider**.

Deliver:

```text
test-hub/
├── schema/
├── registry/
├── orchestrator/
└── providers/
    └── trailblaze/
```

Working behavior:

1. Lighthouse runs normally.
2. Existing LHR is returned.
3. Test Hub layer creates CompositeReport.
4. Static registry exposes Trailblaze.
5. Trailblaze provider can be enabled.
6. Trailblaze execution may initially use a fixture/mock result.
7. Mock Trailblaze result becomes TestResult.
8. CompositeReport contains:
   - Lighthouse LHR
   - Trailblaze TestResult
   - normalized findings
9. Existing Lighthouse behavior remains unchanged when Test Hub is not used.

Do not build the complete Test Shop UI yet if it would delay the architecture.

A minimal development page or JSON output is acceptable for this milestone.

---

# 30. Second Development Milestone

Replace the mocked Trailblaze provider with real local CLI integration.

Requirements:

- detect installed CLI
- execute with timeout
- capture output
- request/generate JSON report
- normalize result
- discover artifacts
- expose errors cleanly
- Web only

---

# 31. Third Development Milestone

Implement Test Shop UI.

Include:

- provider cards
- activation
- status
- category
- pricing
- source repository
- capabilities
- permissions

---

# 32. Fourth Development Milestone

Add a second structurally different provider.

Recommended:

OWASP ZAP.

Reason:

Trailblaze validates journey-oriented results and rich artifacts.

ZAP validates:

- security findings
- severity-heavy results
- another local execution model
- authorization controls
- non-score-centric reporting

If both fit the architecture cleanly, the abstraction is sufficiently general.

---

# 33. Fifth Development Milestone

Add first hosted/metered provider.

Recommended:

WAVE API.

Purpose:

Validate:

- provider API credentials
- external HTTP execution
- cost estimation
- usage metadata
- provider rate-limit errors
- paid/free differentiation in Test Shop

---

# 34. Acceptance Criteria for the Foundation

The foundation is successful when:

- Lighthouse can still run exactly as before.
- CompositeReport exists as a separate versioned model.
- Original LHR remains intact.
- External test results do not need to conform to Lighthouse audit schema.
- TestProvider is implemented.
- Provider registry exists.
- Orchestrator exists.
- Provider failure is isolated.
- Trailblaze is represented as an external provider.
- A mocked Trailblaze result can appear in CompositeReport.
- Tests cover registry, orchestration, normalization, and provider failure.
- No arbitrary GitHub code execution exists.
- No API keys are placed in client-side report output.
- Major changes to Lighthouse core are avoided.

---

# 35. Implementation Philosophy

Prefer:

```text
composition over modification
adapters over forks inside the fork
versioned schemas
small integration hooks
provider isolation
raw-result preservation
normalized findings
progressive enhancement
```

Avoid:

```text
forcing all tools into Lighthouse Audit
rewriting LHR
monolithic runner changes
hardcoded provider-specific report logic
arbitrary GitHub execution
client-side secrets
one universal score
```

The end state should be:

> Lighthouse remains the stable core web-audit engine, while the fork becomes a modular testing shell capable of orchestrating specialized local and hosted testing systems through a Test Shop and aggregating their results into one composite report.
