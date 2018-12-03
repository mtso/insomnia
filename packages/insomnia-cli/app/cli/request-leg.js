// @flow
import { delay } from './helpers';
import * as models from '../models';
import * as network from '../network/network';

// import type { Request } from '../models/request';

// export type RequestLeg = {
//   request: Request
// };

export default class RequestLeg {
  constructor(runner, request, dependencyIds, delayMs) {
    this.request = request;
    this.runner = runner;
    this.dependencyIds = dependencyIds;
    this.delayMs = delayMs;

    this.handleSend = this.handleSend.bind(this);
    this.send = this.send.bind(this);
    this.makeRequestFinishListener = this.makeRequestFinishListener.bind(this);

    runner.on('start', () => {
      if (!dependencyIds || dependencyIds.length < 1) {
        this.handleSend();
      } else {
        runner.on('requestFinish', this.makeRequestFinishListener(dependencyIds));
      }
    });
  }

  /**
   * Returns a function that takes in request completion data
   * and kicks off its own request when the dependencies have resolved.
   */
  makeRequestFinishListener(dependencyIds) {
    // Wait for dependencies to resolve before starting.
    const dependencyIdsMap = dependencyIds.reduce((map, id) => {
      map[id] = id;
      return map;
    }, {});

    return ({ request }) => {
      // Ignore the event if the finished request is not one of the dependencies.
      if (!dependencyIdsMap[request._id]) {
        return;
      }

      delete dependencyIdsMap[request._id];

      if (Object.keys(dependencyIdsMap).length < 1) {
        this.handleSend();
      }
    };
  }

  async handleSend() {
    try {
      await delay(this.delayMs);

      const response = await this.send();
      const result = {
        request: this.request,
        response
      };

      this.runner.emit('requestFinish', result);
    } catch (err) {
      this.runner.emit('error', err);
    }
  }

  async send() {
    console.log('Executing request: ' + this.request.name);
    const responsePatch = await network.send(this.request._id, this.runner.environment._id);

    // TODO: UPDATE REQUEST METADATA?? See how the electron app handles it.
    this.response = await models.response.create(responsePatch);
    return this.response;
  }
}
