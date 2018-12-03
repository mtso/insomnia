// @flow
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import fs from 'fs';

import { importRaw } from './common/import';
import * as database from './common/database';
import * as errorHandling from './main/error-handling';
import * as models from './models';
import Runner from './cli/runner';

const usageContent = [
  {
    header: 'Insomnia REST CLI Runner',
    content: 'Runs API tests like a {italic robot}, not a {italic human}.'
  },
  {
    header: 'Synopsis',
    content:
      '$ insomniac [Insomnia export filepath] --request-groups [folder] --environment [sub environment]'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'request-groups',
        alias: 'g',
        typeLabel: '{underline folder}',
        description: 'The folder of requests to run.'
      },
      {
        name: 'environment',
        alias: 'e',
        typeLabel: '{underline name}',
        description: 'Name of sub environment which contains environment variables.'
      },
      {
        name: 'help',
        alias: 'h',
        description: 'Print this usage guide.'
      }
    ]
  }
];

const commandLineOptions = [
  { name: 'environment', alias: 'e', type: String },
  { name: 'request-groups', alias: 'g', type: String, multiple: true },
  { name: 'insomnia-export-file', alias: 'f', type: String, defaultOption: true },
  { name: 'help', alias: 'h', type: Boolean }
];

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
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

async function cliMain() {
  // Init some important things first
  await database.init(models.types(), { inMemoryOnly: true });
  await errorHandling.init();

  // Set up arguments.
  const options = commandLineArgs(commandLineOptions);
  if (options.help) {
    const usage = commandLineUsage(usageContent);
    console.log(usage);
    return;
  }

  if (!options['insomnia-export-file']) {
    throw new Error('Must specify a source insomnia export filepath');
  }
  if (!options['request-groups'] || options['request-groups'].length < 1) {
    throw new Error('Must specify a request group with --request-groups flag');
  }
  if (!options['environment']) {
    throw new Error('Must specify an environment with --environment flag');
  }

  const importFilepath = options['insomnia-export-file'];
  const environmentName = options['environment'];
  // TODO: Support multiple request groups.
  const requestGroupName = options['request-groups'][0];

  // LOAD WORKSPACE
  console.log('Importing resources from', importFilepath);
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
