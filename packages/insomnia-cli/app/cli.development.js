// @flow
// Configure logging as early as possible.
import './cli/logging';

import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import fs from 'fs-extra';
import logger from 'winston';

import { importRaw } from './common/import';
import * as database from './common/database';
import * as errorHandling from './main/error-handling';
import * as models from './models';
import Runner from './cli/runner';

const OPTION_SOURCE = 'source';
const OPTION_OUTPUT = 'output';
const OPTION_ENVIRONMENT = 'environment';
const OPTION_REQUEST_GROUPS = 'request-groups';
const OPTION_DELAY = 'delay';

const usageContent = [
  {
    header: 'Insomnia REST CLI Runner',
    content: 'Runs Insomnia requests like a {italic robot}, not a {italic human}.'
  },
  {
    header: 'Synopsis',
    content:
      '$ insomniac [filepath to Insomnia export] --request-groups [folder] --environment [sub environment]'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: OPTION_REQUEST_GROUPS,
        alias: 'g',
        typeLabel: '{underline folder}',
        description:
          '(REQUIRED) The folder of requests to run. The folder names are found in the insomnia workspace.'
      },
      {
        name: OPTION_ENVIRONMENT,
        alias: 'e',
        typeLabel: '{underline name}',
        description: '(REQUIRED) Name of sub environment which contains environment variables.'
      },
      {
        name: OPTION_OUTPUT,
        alias: 'o',
        typeLabel: '{underline filepath}',
        description: 'Filepath to save output results.'
      },
      {
        name: OPTION_DELAY,
        alias: 'd',
        typeLabel: '{underline milliseconds}',
        description: 'Milliseconds to delay each request by (defaults to 0).'
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
  { name: OPTION_ENVIRONMENT, alias: 'e', type: String },
  { name: OPTION_REQUEST_GROUPS, alias: 'g', type: String, multiple: true },
  { name: OPTION_SOURCE, type: String, defaultOption: true },
  { name: OPTION_OUTPUT, alias: 'o', type: String },
  { name: OPTION_DELAY, alias: 'd', type: Number },
  // { name: OPTION_TIMEOUT, alias: 't', type: Number }, // To cancel a request running for too long.
  { name: 'help', alias: 'h', type: Boolean }
];

(async () => {
  try {
    await cliMain();
    process.exit(0);
  } catch (err) {
    logger.error(err);
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
    logger.info(usage);
    return;
  }

  // Check arguments.
  if (!options[OPTION_SOURCE]) {
    throw new Error('Must specify a filepath to an Insomnia export');
  }
  if (!options[OPTION_REQUEST_GROUPS] || options[OPTION_REQUEST_GROUPS].length < 1) {
    throw new Error('Must specify a request group with --request-groups flag');
  }
  if (!options[OPTION_ENVIRONMENT]) {
    throw new Error('Must specify an environment with --environment flag');
  }

  const importFilepath = options[OPTION_SOURCE];
  const environmentName = options['environment'];
  // TODO: Support multiple request groups.
  const requestGroupName = options['request-groups'][0];

  // Load workspace.
  logger.info('Importing resources from', importFilepath);
  const { workspace, summary } = await importFile(importFilepath);

  const runner = new Runner(workspace);
  const foundRequests = await runner.setup(
    requestGroupName,
    environmentName,
    options[OPTION_DELAY] || 0
  );
  const highestDependencyCount = foundRequests.reduce((most, req) => {
    if (req.dependencyIds.length > most) {
      return req.dependencyIds.length;
    } else {
      return most;
    }
  }, 0);
  logger.info(
    `Found ${
      foundRequests.length
    } requests. Highest number of dependencies: ${highestDependencyCount}.`
  );

  const start = Date.now();
  const results = await runner.run();
  const elapsedMs = Date.now() - start;

  // Report results.
  logger.info(
    `Completed ${results.length} requests (${requestGroupName}) in ${elapsedMs / 1000} seconds.`
  );
  logger.info('Status\tMethod\tRequest Name');
  for (const { status, request, response, error } of results) {
    logger.info(`${status}\t${request.method}\t${request.name}`);
  }
  if (options[OPTION_OUTPUT]) {
    logger.info('Writing results to ' + options[OPTION_OUTPUT]);
    await fs.writeFile(options[OPTION_OUTPUT], JSON.stringify(results, null, 2), 'utf8');
  }
}

// Requires database to have been initialized first.
async function importFile(filepath) {
  // Don't generate new IDs, the existing ones are used in response tags.
  const { source, summary, error } = await importRaw(
    null,
    await fs.readFile(filepath, 'utf8'),
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
