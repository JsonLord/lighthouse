/** @param {{status?: string, conclusion?: string|null}} workflowRun */
function normalizeGitHubActionsStatus(workflowRun) {
  if (workflowRun.status === 'queued' || workflowRun.status === 'waiting' ||
      workflowRun.status === 'pending') return 'queued';
  if (workflowRun.status === 'in_progress' || workflowRun.status === 'requested') return 'running';
  if (workflowRun.status !== 'completed') return 'running';
  if (workflowRun.conclusion === 'success') return 'completed';
  if (workflowRun.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

export {normalizeGitHubActionsStatus};
