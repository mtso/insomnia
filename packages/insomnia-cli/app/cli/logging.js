// @flow
import logger from 'winston';

// Make this its own module so that top-level imports don't get hoisted before the configuration.
logger.configure({
  transports: [new logger.transports.Console({ level: process.env.LOG_LEVEL || 'info' })]
});
