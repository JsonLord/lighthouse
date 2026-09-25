/** @param {unknown} value @param {string} name */
function parseJsonFile(value, name) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${name} must contain a JSON object`);
  }
}

/**
 * Validates a backend-decoded artifact bundle. Zip extraction and credentials
 * remain behind the trusted GitHubActionsClient transport.
 * @param {{files?: Record<string, unknown>, references?: Record<string, string>}} bundle
 * @param {{testHubRunId: string, providerId: string, workflow: string}} expected
 */
function importGitHubActionsArtifact(bundle, expected) {
  if (!bundle?.files || typeof bundle.files !== 'object') {
    throw new Error('GitHub Actions artifact bundle is missing files');
  }
  const metadata = parseJsonFile(bundle.files['metadata.json'], 'metadata.json');
  if (metadata.schemaVersion !== 1 || metadata.testHubRunId !== expected.testHubRunId ||
      metadata.providerId !== expected.providerId || metadata.workflow !== expected.workflow) {
    throw new Error('GitHub Actions artifact metadata does not match the requested run');
  }
  const summary = parseJsonFile(bundle.files['summary.json'], 'summary.json');
  const files = Object.keys(bundle.files);
  const references = {};
  for (const [name, url] of Object.entries(bundle.references || {})) {
    if (files.includes(name) && typeof url === 'string' && /^https:\/\//.test(url)) {
      references[name] = url;
    }
  }
  return {metadata, summary, files, references};
}

export {importGitHubActionsArtifact};
