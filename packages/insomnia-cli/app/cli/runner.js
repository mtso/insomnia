// @flow
import { EventEmitter } from 'events';

import { getRequestDependencyIds, findEnvironmentsByName } from './helpers';
import * as database from '../common/database';
import * as models from '../models';
import RequestLeg from './request-leg';

// import type { Workspace } from '../models/workspace';

export default class Runner extends EventEmitter {
  constructor(workspace) {
    super();
    this.workspace = workspace;
    this.requests = [];

    this.setup = this.setup.bind(this);
    this.run = this.run.bind(this);
  }

  async setup(requestGroupName, environmentName, delay = 0) {
    const environments = await findEnvironmentsByName(this.workspace._id, environmentName);
    if (environments.length !== 1) {
      throw new Error('Environment not found: ' + environmentName);
    }
    this.environment = environments[0];

    const requestGroup = await database.getWhere(models.requestGroup.type, {
      name: requestGroupName
    });

    const requests = await models.request.findByParentId(requestGroup._id);

    this.requestLegs = requests.reduce((map, request) => {
      const dependencyIds = getRequestDependencyIds(request);

      map[request._id] = new RequestLeg(this, request, dependencyIds, delay);
      return map;
    }, {});
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
