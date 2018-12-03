// @flow
import fs from 'fs';

import { importRaw } from './common/import';
import * as database from './common/database';
import * as errorHandling from './main/error-handling';
import * as models from './models';
import Runner from './cli/runner';

/**
 * Environment Variables:
 * - ENV
 * - IMPORT_PATH
 * - GROUP
 *
 * Usage from monorepo root:
 * GROUP=[request group name] ENV=[environment name] IMPORT_PATH=[filepath] npm run cli-start
 */

(async () => {
  try {
    await cliMain();
  } catch (err) {
    console.error(err);
  }
})();

async function cliMain() {
  // Init some important things first
  await database.init(models.types(), { inMemoryOnly: true });
  await errorHandling.init();

  // Argument setups.
  const importFilepath = process.env.IMPORT_PATH;
  const environmentName = process.env.ENV;
  const requestGroupName = process.env.GROUP;

  // LOAD WORKSPACE
  console.log('Importing workspace from', importFilepath);
  const { workspace, summary } = await importFile(importFilepath);

  const runner = new Runner(workspace);
  await runner.setup(requestGroupName, environmentName);

  const start = Date.now();
  const results = await runner.run();
  const diff = Date.now() - start;
  const secondsElapsed = diff / 1000;

  console.log(
    `Completed ${results.length} requests (${requestGroupName}) in ${secondsElapsed} seconds.`
  );
  console.log(
    results.reduce((statuses, res) => {
      statuses[res.request.name] = res.response.statusCode;
      return statuses;
    }, {})
  );
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
