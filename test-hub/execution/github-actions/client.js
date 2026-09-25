/**
 * Backend-only façade. Credentials live in the injected transport and are never
 * accepted by run configuration or returned in execution references.
 */
class GitHubActionsClient {
  /** @param {{dispatchWorkflow: Function, getWorkflowRun: Function, listArtifacts: Function, downloadArtifact: Function, cancelWorkflow: Function}} transport */
  constructor(transport) {
    this.transport = transport;
    for (const method of [
      'dispatchWorkflow', 'getWorkflowRun', 'listArtifacts', 'downloadArtifact',
      'cancelWorkflow',
    ]) {
      if (typeof transport?.[method] !== 'function') {
        throw new Error(`GitHub Actions transport must implement ${method}()`);
      }
    }
  }

  dispatchWorkflow(request) {
    return this.transport.dispatchWorkflow(request);
  }
  getWorkflowRun(reference) {
    return this.transport.getWorkflowRun(reference);
  }
  listArtifacts(reference) {
    return this.transport.listArtifacts(reference);
  }
  downloadArtifact(reference) {
    return this.transport.downloadArtifact(reference);
  }
  cancelWorkflow(reference) {
    return this.transport.cancelWorkflow(reference);
  }
}

export {GitHubActionsClient};
