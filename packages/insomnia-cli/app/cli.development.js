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

(async () => {
  // Init some important things first
  await database.init(models.types());
  await errorHandling.init();

  const importFilepath = process.env.IMPORT_PATH; // IMPORT_PATH=[filepath] npm run cli-start
  const environmentName = process.env.ENV;
  // req_8fa8104b83cf4985be3141583ee00c61 -> target req
  const requestId = 'req_8fa8104b83cf4985be3141583ee00c61';

  console.log('importing from ' + importFilepath);

  const { workspace, summary } = await importFile(importFilepath);
  console.log('workspace: ' + JSON.stringify(workspace).slice(0, 80));
  console.log('summary: ' + JSON.stringify(summary).slice(0, 80));
  // console.log(workspace);

  // const envs = await models.environment.findByParentId(workspace._id);
  // console.log(JSON.stringify(envs, null, 2));

  // console.log('Searching for ' + environmentName);
  // const environments = await findEnvironmentsByName(workspace._id, environmentName);
  // // for (const env of envs) {
  // //   if (env.name === environmentName) {
  //     console.log('Environment choice: ');
  //     console.log(JSON.stringify(environments, null, 2));
  // //   }
  // // }

  // const requestGroups = await models.requestGroup.findByParentId(workspace._id);
  // console.log(`Found ${requestGroups.length} groups`);
  // for (const requestGroup of requestGroups) {
  //   const requests = await models.request.findByParentId(requestGroup._id);
  //   console.log(`Requests under group: ${requestGroup.name}`);
  //   console.log(requests.map(r => r.name));
  // }
  const environments = await findEnvironmentsByName(workspace._id, environmentName);
  if (environments.length !== 1) {
    throw new Error('Environment not found: ' + environmentName);
  }
  const environment = environments[0];

  const request = await models.request.getById(requestId);
  // console.log(JSON.stringify(request, null, 2));
  console.log('Found request: ' + request.name);

  console.log('\n\n\n    !!! PASSED !!!\n\n\n');

  // const requestPatch = await network.send(request._id, environment._id);

  // console.log(JSON.stringify(requestPatch, null, 2));

  process.exit(0);
})();

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
