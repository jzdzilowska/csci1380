// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const id = require('../util/id.js');

// total messages
let messageCount = 0;

/**
 * called by the server when handling requests
 */
function incrementCount() {
  messageCount++;
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  // optional callback, if not provided use a no-op func
  callback = callback || function() {};
  const config = globalThis.distribution.node.config;

  switch (configuration) {
    case 'nid':
      // Node ID (SHA256 hash of the node object)
      return callback(null, id.getNID(config));

    case 'sid':
      // Short ID (first 5 characters of the NID)
      return callback(null, id.getSID(config));

    case 'ip':
      // The listening IP address
      return callback(null, config.ip);

    case 'port':
      // The listening port
      return callback(null, config.port);

    case 'counts':
      // Total message count
      return callback(null, messageCount);

    case 'heapTotal':
      // Total heap memory allocated
      return callback(null, process.memoryUsage().heapTotal);

    case 'heapUsed':
      // Heap memory currently in use
      return callback(null, process.memoryUsage().heapUsed);

    default:
      // Unknown config key, return an error
      return callback(new Error(`Status key '${configuration}' not found`));
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  callback(new Error('status.spawn not implemented'));
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(new Error('status.stop not implemented'));
}

module.exports = {get, spawn, stop, incrementCount};
