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

  // T3
  if (typeof object === 'function') {
    return JSON.stringify({type: 'function', value: object.toString()});
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

    case 'function': {
      // eval - execute code from a string
      // whats within eval must be a valid JS expression
      // i.e., evaluate to a single value, not a statement/block of code
      // i.e., force an expression to be evaluated
      // we wrap the function string in parentheses to make it a valid expression
      const fn = eval('(' + parsed.value + ')');
      return fn;
    }

    default:
      throw new Error("Unknown serialized type: ${parsed.type}");
  }
}

module.exports = {
  serialize,
  deserialize,
};
