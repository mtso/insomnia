// @flow
import fs from 'fs';

import { importRaw } from './common/import';
import * as database from './common/database';
import * as errorHandling from './main/error-handling';
import * as models from './models';
import * as network from './network/network';

/**
 * Environment Variables:
 * - ENV
 * - IMPORT_PATH
 *
 *
 * Usage:
 * ENV=[environment name] IMPORT_PATH=~/dev/log/Insomnia_2018-11-29.json npm run cli-start
 */

try {
  cliMain();
} catch (err) {
  console.error(err);
}

async function cliMain() {
  // Init some important things first
  await database.init(models.types(), { inMemoryOnly: true });
  await errorHandling.init();

  // Argument setups.
  const importFilepath = process.env.IMPORT_PATH; // IMPORT_PATH=[filepath] npm run cli-start
  const environmentName = process.env.ENV;

  // Request IDs for testing.
  const requestId = 'req_8fa8104b83cf4985be3141583ee00c61'; // -> NO response tag (pure)
  const requestIdWithTag = 'req_df35bb3f76bc4f66be44f17fba5b4a27'; // -> with response tag
  // const requestId = 'req_8fa8104b83cf4985be3141583ee00c62'; // -> hard-coded

  // LOAD WORKSPACE
  console.log('importing from', importFilepath);
  const { workspace, summary } = await importFile(importFilepath);
  console.log('workspace: ' + JSON.stringify(workspace).slice(0, 80));
  console.log('summary: ' + JSON.stringify(summary).slice(0, 80));
  const environments = await findEnvironmentsByName(workspace._id, environmentName);
  if (environments.length !== 1) {
    throw new Error('Environment not found: ' + environmentName);
  }
  const environment = environments[0];

  const preRequest = await models.request.getById(requestId);
  const responsePatch = await network.send(preRequest._id, environment._id);
  await models.response.create(responsePatch);
  const response = await models.response.getLatestForRequest(preRequest._id);
  console.log(response);

  // SETUP REQUEST
  const request = await models.request.getById(requestIdWithTag);
  // console.log('Found request: ' + request.name);

  // console.log(getRequestDependencies(request))

  const requestPatch = await network.send(request._id, environment._id);

  console.log(JSON.stringify(requestPatch, null, 2));

  console.log('\n\n\n    !!! PASSED !!!\n\n\n');
  process.exit(0);
}

// Requires database to have been initialized first.
async function importFile(filepath) {
  // Don't generate new IDs, we need them for response tags.
  const { source, summary, error } = await importRaw(
    null,
    fs.readFileSync(filepath, 'utf8'),
    false
  );
  if (error) {
    throw error;
  }
  if (summary.Workspace.length !== 1) {
    throw new Error('Expected exactly one workspace document in the import file');
  }

  return {
    source,
    summary,
    workspace: summary.Workspace[0]
  };
}

async function findEnvironmentsByName(rootId, name) {
  const environments = await models.environment.findByParentId(rootId);
  const matched = await Promise.all(
    environments.map(async env => {
      let found = [];
      if (env.name === name) {
        found = found.concat([env]);
      }
      found = found.concat(await findEnvironmentsByName(env._id, name));
      return found;
    })
  );
  return matched.reduce((acc, envs) => {
    return acc.concat(envs);
  }, []);
}

function getRequestDependencies(request) {
  function extractTags(text) {
    // Assume no nested tags.
    const OPEN_DELIM = '{%';
    const CLOSE_DELIM = '%}';
    const tags = [];
    let start = -1;
    for (let i = 0; i < text.length; ++i) {
      const view = text.substring(i, i + 2);
      if (view === OPEN_DELIM) {
        start = i;
      } else if (view === CLOSE_DELIM) {
        const end = i + 2;
        tags.push(text.substring(start, end));
        start = -1;
      }
    }
    return tags;
  }

  const fields = [request.body.text, request.url, ...request.headers.map(h => h.value)];

  const tags = fields.map(extractTags).reduce((a, b) => a.concat(b), []);
  return tags
    .map(tag => {
      const match = tag.match(/req_[a-f0-9]+/);
      return match && match[0];
    })
    .filter(v => !!v);
}
