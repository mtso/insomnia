// @flow
import { delay } from './helpers';
import * as models from '../models';
import * as network from '../network/network';
import logger from 'winston';

export default class RequestLeg {
  request;
  runner;
  dependencyIds;
  delayMs;

  handleSend;
  send;
  makeRequestFinishListener;

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
        this.handleSend(0); // No delay for requests without dependencies.
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

    return ({ request, error }) => {
      // Ignore the event if the finished request is not one of the dependencies.
      if (!dependencyIdsMap[request._id]) {
        return;
      }

      // This means that one of the dependencies had an error and so we will never resolve.
      if (error) {
        this.runner.emit('requestFinish', {
          status: 'NOT RUN',
          request: this.request,
          response: null,
          error: null
        });
        return;
      }

      delete dependencyIdsMap[request._id];
      logger.verbose(`Dependencies left: ${Object.keys(dependencyIdsMap).length}`);

      if (Object.keys(dependencyIdsMap).length < 1) {
        this.handleSend(this.delayMs);
      }
    };
  }

  async handleSend(delayMs) {
    try {
      logger.verbose(`Delaying for ${delayMs}ms`);
      await delay(delayMs);

      const sendResponse = await this.send();

      let response, error, status;
      if (sendResponse instanceof Error) {
        error = sendResponse;
        response = null;
        status = 'ERROR';
      } else {
        error = null;
        response = sendResponse;
        status = response.statusCode;
      }

      const { request } = this;

      this.runner.emit('requestFinish', { status, request, response, error });
    } catch (err) {
      logger.error(err);
      // Catch any unexpected errors
      this.runner.emit('error', err);
    }
  }

  async send() {
    logger.info(
      `Executing request: ${(this.request.method + ' ').slice(0, 4)} ${this.request.name}`
    );

    let responsePatch;
    try {
      responsePatch = await network.send(this.request._id, this.runner.environment._id);
    } catch (err) {
      logger.verbose('Error sending request: ' + err.message);
      // Assume that a previous request did not resolve.
      // Emit an event that other requests will use to not continue.
      return new Error('Error sending request ' + this.request._id + ': ' + err.message);
    }
    // TODO: UPDATE REQUEST METADATA?? See how the electron app handles it.
    return await models.response.create(responsePatch);
  }
}
