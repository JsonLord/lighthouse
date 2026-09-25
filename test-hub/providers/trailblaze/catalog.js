/** Controlled product IDs. Browser configuration never supplies repository paths. */
const TRAILBLAZE_TEST_CATALOG = Object.freeze({
  login: Object.freeze({trail: 'test-hub/providers/trailblaze/trails/login/login.trail.yaml'}),
  search: Object.freeze({trail: 'test-hub/providers/trailblaze/trails/search/search.trail.yaml'}),
  checkout: Object.freeze({
    trail: 'test-hub/providers/trailblaze/trails/checkout/checkout.trail.yaml',
  }),
});

const TRAILBLAZE_BROWSERS = Object.freeze(['chromium']);

/** @param {string} testId */
function getTrailblazeTest(testId) {
  const test = TRAILBLAZE_TEST_CATALOG[testId];
  if (!test) throw new Error(`Unknown Trailblaze test: ${testId}`);
  return test;
}

export {getTrailblazeTest, TRAILBLAZE_BROWSERS, TRAILBLAZE_TEST_CATALOG};
