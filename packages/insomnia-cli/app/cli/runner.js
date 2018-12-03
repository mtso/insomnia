// @flow
import { EventEmitter } from 'events';
import logger from 'winston';

import { getRequestDependencyIds, findEnvironmentsByName } from './helpers';
import * as database from '../common/database';
import * as models from '../models';
import RequestLeg from './request-leg';

export default class Runner extends EventEmitter {
  constructor(workspace) {
    super();
    this.workspace = workspace;
    this.requests = [];

    this.setup = this.setup.bind(this);
    this.run = this.run.bind(this);
  }

  // TODO: Resolve and add to the run all the dependencies
  // (even if they are outside of the request group).
  async setup(requestGroupName, environmentName, delayMs = 0) {
    const environments = await findEnvironmentsByName(this.workspace._id, environmentName);
    const environmentNames = JSON.stringify(environments.map(e => e.name), null, 2);
    logger.verbose(`Found environments matching ${environmentName}`);
    logger.verbose(environmentNames);

    // Only continue if the given name matches exactly one.
    // Could cause problems in the future if multiple sub-environments have the same name.
    if (environments.length !== 1) {
      throw new Error('Environment not found: ' + environmentName);
    }
    this.environment = environments[0];

    const requestGroup = await database.getWhere(models.requestGroup.type, {
      name: requestGroupName
    });

    const requests = await models.request.findByParentId(requestGroup._id);

    this.setMaxListeners(requests.length + 2);

    // TODO: Refactor this block into a purer sequence of operations.
    this.requestLegs = requests.reduce((map, request) => {
      const dependencyIds = getRequestDependencyIds(request);
      request.dependencyIds = dependencyIds;
      logger.verbose(`Found dependencies for ${request.name}`);
      logger.verbose(JSON.stringify(dependencyIds, null, 2));

      map[request._id] = new RequestLeg(this, request, dependencyIds, delayMs);
      return map;
    }, {});

    return requests;
  }

  async run() {
    const completionMap = {};
    const requestCount = Object.keys(this.requestLegs).length;

    return new Promise((resolve, reject) => {
      this.on('requestFinish', result => {
        if (completionMap[result.request._id]) {
          return;
        }

        completionMap[result.request._id] = result;

        if (Object.keys(completionMap).length >= requestCount) {
          resolve(Object.values(completionMap));
        }
      });

      this.on('error', err => reject(err));

      this.emit('start');
    });
  }
}
