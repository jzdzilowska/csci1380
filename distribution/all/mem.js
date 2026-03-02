// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(configuration: Object.<string, Node>, callback: Callback) => void} reconf
 */


/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || globalThis.distribution.util.id.naiveHash;

  const id = globalThis.distribution.util.id;

  /**
   * @param {SimpleConfig} configuration
   * @returns {{key: string | null, gid: string}}
   */
  // config arg can come in as a plain str key, null, object {key, gid}.
  // ormalizes it so the rest of the code can always destructure {key, gid}.
  function parseConfig(configuration) {
    if (configuration === null || configuration === undefined) {
      return {key: null, gid: context.gid};
    }
    if (typeof configuration === 'string') {
      return {key: configuration, gid: context.gid};
    }
    return {
      key: configuration.key !== undefined ? configuration.key : null,
      gid: configuration.gid || context.gid,
    };
  }

  // givn a key ID (kid), figure out which node in the group is responsible
  // Looks up the groups node list, hashes the kid against their nids,
  // returns the matching node object so we comm.send to it
  function resolveNode(kid, callback) {
    globalThis.distribution.local.groups.get(context.gid, (e, group) => {
      if (e) return callback(e);
      const nodes = Object.values(group);
      const nids = nodes.map((n) => id.getNID(n));
      const targetNid = context.hash(kid, nids);
      const targetNode = nodes.find((n) => id.getNID(n) === targetNid);
      // if no target node, return error
      if (!targetNode) {
        return callback(new Error('Could not resolve target node'));
      }
      callback(null, targetNode);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  // get(null) useful for reconf since we need to know
  //             what's stored where
  function get(configuration, callback) {
    const {key, gid} = parseConfig(configuration);

    if (key === null) {
      // Fan-out: ask every node in the group for its keys
      globalThis.distribution.local.groups.get(context.gid, (e, group) => {
        if (e) return callback(e);
        const nodes = Object.values(group);
        let pending = nodes.length;
        const allKeys = [];
        /** @type {Object.<string, Error>} */
        const errors = {};

        if (pending === 0) return callback(errors, allKeys);

        nodes.forEach((node) => {
          const remote = {node, service: 'mem', method: 'get'};
          const message = [{key: null, gid}];
          globalThis.distribution.local.comm.send(message, remote, (e, v) => {
            if (e) {
              errors[id.getSID(node)] = e;
            }
            if (v && Array.isArray(v)) {
              allKeys.push(...v);
            }
            if (--pending === 0) {
              callback(errors, allKeys);
            }
          });
        });
      });
      return;
    }

    // Single-key get: hash the key, find the right node, ask it
    const kid = id.getID(key);
    resolveNode(kid, (e, targetNode) => {
      if (e) return callback(e);
      const remote = {node: targetNode, service: 'mem', method: 'get'};
      const message = [{key, gid}];
      globalThis.distribution.local.comm.send(message, remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    let {key, gid} = parseConfig(configuration);
    if (key === null) key = id.getID(state);

    const kid = id.getID(key);
    resolveNode(kid, (e, targetNode) => {
      if (e) return callback(e);
      // TODO: check if targetNode is the local node
      const remote = {node: targetNode, service: 'mem', method: 'put'};
      const message = [state, {key, gid}];
      globalThis.distribution.local.comm.send(message, remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    let {key, gid} = parseConfig(configuration);
    if (key === null) key = id.getID(state);

    const kid = id.getID(key);
    resolveNode(kid, (e, targetNode) => {
      if (e) return callback(e);
      const remote = {node: targetNode, service: 'mem', method: 'append'};
      const message = [state, {key, gid}];
      globalThis.distribution.local.comm.send(message, remote, callback);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  // del: hash the key find the node delete from that node's local mem
  // reqs a non-null key (can't mass-delete?)
  function del(configuration, callback) {
    const {key, gid} = parseConfig(configuration);
    if (key === null) {
      return callback(new Error('Key is required for del'));
    }

    const kid = id.getID(key);
    // send to the node that owns the key
    resolveNode(kid, (e, targetNode) => {
      if (e) return callback(e);
      const remote = {node: targetNode, service: 'mem', method: 'del'};
      const message = [{key, gid}];
      globalThis.distribution.local.comm.send(message, remote, callback);
    });
  }

  /**
   * @param {Object.<string, Node>} configuration - the old group state
   * @param {Callback} callback
   */
  //   1. get every key currently stored across all nodes fan out
  //   2. for each k, rehash against the old nids and new nids
  //   3. if the responsible node changed move the value: get from old, del, put to new
  function reconf(configuration, callback) {
    const oldGroup = configuration;
    const oldNodes = Object.values(oldGroup);
    const oldNids = oldNodes.map((n) => id.getNID(n));

    get(null, (e, keys) => {
      if (!keys || keys.length === 0) return callback(null, null);

      globalThis.distribution.local.groups.get(context.gid, (e, newGroup) => {
        if (e) return callback(e);
        const newNodes = Object.values(newGroup);
        const newNids = newNodes.map((n) => id.getNID(n));

        // which keys need to move
        const toRelocate = [];
        for (const key of keys) {
          const kid = id.getID(key);
          const oldNid = context.hash(kid, oldNids);
          const newNid = context.hash(kid, newNids);
          if (oldNid !== newNid) {
            const oldNode = oldNodes.find((n) => id.getNID(n) === oldNid);
            const newNode = newNodes.find((n) => id.getNID(n) === newNid);
            if (oldNode && newNode) {
              toRelocate.push({key, oldNode, newNode});
            }
          }
        }

        if (toRelocate.length === 0) return callback(null, null);

        let pending = toRelocate.length;
        const gid = context.gid;

        // for each key that moved: get value from old node, delete it, put on new node
        toRelocate.forEach(({key, oldNode, newNode}) => {
          const getRemote = {node: oldNode, service: 'mem', method: 'get'};
          globalThis.distribution.local.comm.send(
              [{key, gid}], getRemote, (e, value) => {
                if (e) {
                  if (--pending === 0) callback(null, null);
                  return;
                }
                const delRemote = {node: oldNode, service: 'mem', method: 'del'};
                globalThis.distribution.local.comm.send(
                    [{key, gid}], delRemote, (e2, v2) => {
                      const putRemote = {
                        node: newNode, service: 'mem', method: 'put',
                      };
                      globalThis.distribution.local.comm.send(
                          [value, {key, gid}], putRemote, (e3, v3) => {
                            if (--pending === 0) callback(null, null);
                          });
                    });
              });
        });
      });
    });
  }
  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;
