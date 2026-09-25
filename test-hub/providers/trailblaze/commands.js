/**
 * Trailblaze CLI contract pinned to v2026.09.11.
 * Keep all upstream flag spelling in this module.
 */

const SUPPORTED_TRAILBLAZE_RELEASE = 'v2026.09.11';

function buildVersionCommand() {
  return ['--version'];
}

function buildDeviceListCommand() {
  return ['device', 'list'];
}

/** @param {{trailPath: string, testName: string}} config */
function buildRunCommand(config) {
  return [
    'run',
    '--device', 'web',
    '--no-daemon',
    '--test-name', config.testName,
    config.trailPath,
  ];
}

/** @param {string} sessionId @param {string} outputDirectory */
function buildReportCommand(sessionId, outputDirectory) {
  return ['report', '--id', sessionId, '--output-dir', outputDirectory];
}

export {
  buildDeviceListCommand,
  buildReportCommand,
  buildRunCommand,
  buildVersionCommand,
  SUPPORTED_TRAILBLAZE_RELEASE,
};
