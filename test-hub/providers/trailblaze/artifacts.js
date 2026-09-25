/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const MAX_ARTIFACT_FILES = 1000;

/** @param {string} filePath */
function describeArtifact(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  if (extension === '.json') {
    return {type: 'json', mimeType: 'application/json', label: 'Trailblaze JSON result'};
  }
  if (extension === '.html') {
    return {type: 'html', mimeType: 'text/html', label: 'Open Trailblaze Trace'};
  }
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
    const imageType = extension.slice(1).replace('jpg', 'jpeg');
    return {type: 'image', mimeType: `image/${imageType}`, label: 'Trailblaze image'};
  }
  if (extension === '.zip') {
    return {type: 'archive', mimeType: 'application/zip', label: 'Trailblaze session archive'};
  }
  if (['.log', '.txt'].includes(extension)) {
    return {type: 'log', mimeType: 'text/plain', label: 'Trailblaze log'};
  }
  if (basename.includes('trace') || basename.includes('timeline') ||
      basename.includes('storyboard')) {
    return {type: 'trace', label: 'Trailblaze trace'};
  }
  return {type: 'other', label: 'Trailblaze artifact'};
}

/** @param {string} root @param {string[]} files */
async function walk(root, files) {
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= MAX_ARTIFACT_FILES) return;
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) await walk(filePath, files);
    else if (entry.isFile()) files.push(filePath);
  }
}

/** @param {unknown} rawResult */
export async function collectTrailblazeArtifacts(rawResult) {
  if (rawResult?.executionMode === 'fixture') {
    const fixtureArtifacts = rawResult.resultJson?.artifacts || [];
    return fixtureArtifacts.map((artifact, index) => ({
      id: `trailblaze-artifact-${index + 1}`,
      providerId: 'trailblaze',
      type: artifact.type,
      label: artifact.label,
      mimeType: artifact.mimeType,
      path: artifact.path,
    }));
  }
  if (rawResult?.executionMode === 'github-actions') {
    return (rawResult.remoteFiles || [])
        .filter(name => name !== 'metadata.json')
        .map((name, index) => ({
          id: `trailblaze-remote-artifact-${index + 1}`,
          providerId: 'trailblaze',
          ...describeArtifact(name),
          url: rawResult.remoteReferences?.[name],
          metadata: {remote: true, name},
        }))
        .filter(artifact => artifact.url);
  }
  const files = [];
  if (typeof rawResult?.reportDirectory === 'string') {
    await walk(rawResult.reportDirectory, files);
  }
  if (typeof rawResult?.sessionDirectory === 'string') {
    await walk(rawResult.sessionDirectory, files);
  }
  if (typeof rawResult?.resultPath === 'string' && !files.includes(rawResult.resultPath)) {
    try {
      if ((await stat(rawResult.resultPath)).isFile()) files.push(rawResult.resultPath);
    } catch {
      // Missing optional artifacts are ignored.
    }
  }
  return Promise.all(files.map(async (filePath, index) => ({
    id: `trailblaze-artifact-${index + 1}`,
    providerId: 'trailblaze',
    ...describeArtifact(filePath),
    path: filePath,
    sizeBytes: (await stat(filePath)).size,
  })));
}
