// @ts-check

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  // typeof null === object
  if (object === null) {
    return JSON.stringify({type: 'null', value: null});
  }

  if (object === undefined) {
    return JSON.stringify({type: 'undefined', value: null});
  }

  // number including NaN and infinity
  if (typeof object === 'number') {
    if (Number.isNaN(object)) {
      return JSON.stringify({type: 'number', value: 'NaN'});
    }
    if (object === Infinity) {
      return JSON.stringify({type: 'number', value: 'Infinity'});
    }
    if (object === -Infinity) {
      return JSON.stringify({type: 'number', value: '-Infinity'});
    }
    // a regular num
    return JSON.stringify({type: 'number', value: object});
  }

  if (typeof object === 'string') {
    return JSON.stringify({type: 'string', value: object});
  }

  if (typeof object === 'boolean') {
    return JSON.stringify({type: 'boolean', value: object});
  }

  // fallback for now - TODO: extend later
  return JSON.stringify({type: 'unknown', value: String(object)});
}


/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  if (typeof string !== 'string') {
    throw new Error("Invalid argument type: ${typeof string}.");
  }

  const parsed = JSON.parse(string);

  switch (parsed.type) {
    case 'null':
      return null;

    case 'undefined':
      return undefined;

    case 'number':
      if (parsed.value === 'NaN') {
        return NaN;
      }
      if (parsed.value === 'Infinity') {
        return Infinity;
      }
      if (parsed.value === '-Infinity') {
        return -Infinity;
      }
      return parsed.value;

    case 'string':
      return parsed.value;

    case 'boolean':
      return parsed.value;

    default:
      throw new Error("Unknown serialized type: ${parsed.type}");
  }
}

module.exports = {
  serialize,
  deserialize,
};
