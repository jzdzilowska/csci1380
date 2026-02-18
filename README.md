# distribution

This is the distribution library. 

## Environment Setup

We recommend using the prepared [container image](https://github.com/brown-cs1380/container).

## Installation

After you have setup your environment, you can start using the distribution library.
When loaded, distribution introduces functionality supporting the distributed execution of programs. To download it:

```sh
$ npm i '@brown-ds/distribution'
```

This command downloads and installs the distribution library.

## Testing

There are several categories of tests:
  *	Regular Tests (`*.test.js`)
  *	Scenario Tests (`*.scenario.js`)
  *	Extra Credit Tests (`*.extra.test.js`)
  * Student Tests (`*.student.test.js`) - inside `test/test-student`

### Running Tests

By default, all regular tests are run. Use the options below to run different sets of tests:

1. Run all regular tests (default): `$ npm test` or `$ npm test -- -t`
2. Run scenario tests: `$ npm test -- -c` 
3. Run extra credit tests: `$ npm test -- -ec`
4. Run the `non-distribution` tests: `$ npm test -- -nd`
5. Combine options: `$ npm test -- -c -ec -nd -t`

## Usage

To try out the distribution library inside an interactive Node.js session, run:

```sh
$ node
```

Then, load the distribution library:

```js
> let distribution = require("@brown-ds/distribution")();
> distribution.node.start(console.log);
```

Now you have access to the full distribution library. You can start off by serializing some values. 

```js
> s = distribution.util.serialize(1); // '{"type":"number","value":"1"}'
> n = distribution.util.deserialize(s); // 1
```

You can inspect information about the current node (for example its `sid`) by running:

```js
> distribution.local.status.get('sid', console.log); // null 8cf1b (null here is the error value; meaning there is no error)
```

You can also store and retrieve values from the local memory:

```js
> distribution.local.mem.put({name: 'nikos'}, 'key', console.log); // null {name: 'nikos'} (again, null is the error value) 
> distribution.local.mem.get('key', console.log); // null {name: 'nikos'}

> distribution.local.mem.get('wrong-key', console.log); // Error('Key not found') undefined
```

You can also spawn a new node:

```js
> node = { ip: '127.0.0.1', port: 8080 };
> distribution.local.status.spawn(node, console.log);
```

Using the `distribution.all` set of services will allow you to act 
on the full set of nodes created as if they were a single one.

```js
> distribution.all.status.get('sid', console.log); // {} { '8cf1b': '8cf1b', '8cf1c': '8cf1c' } (now, errors are per-node and form an object)
```

You can also send messages to other nodes:

```js
> distribution.local.comm.send(['sid'], {node: node, service: 'status', method: 'get'}, console.log); // null 8cf1c
```

Most methods in the distribution library are asynchronous and take a callback as their last argument.
This callback is called when the method completes, with the first argument being an error (if any) and the second argument being the result.
If you wanted to run this same sequence of commands in a script, you could do something like this (note the nested callbacks):

```js
let distribution = require("@brown-ds/distribution")();
// Now we're only doing a few of the things we did above
const out = (cb) => {
  distribution.local.status.stop(cb); // Shut down the local node
};
distribution.node.start(() => {
  // This will run only after the node has started
  const node = {ip: '127.0.0.1', port: 8765};
  distribution.local.status.spawn(node, (e, v) => {
    if (e) {
      return out(console.log);
    }
    // This will run only after the new node has been spawned
    distribution.all.status.get('sid', (e, v) => {
      // This will run only after we communicated with all nodes and got their sids
      console.log(v); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
      // Shut down the remote node
      distribution.local.comm.send([], {service: 'status', method: 'stop', node: node}, () => {
        // Finally, stop the local node
        out(console.log); // null, {ip: '127.0.0.1', port: 1380}
      });
    });
  });
});
```

# Results and Reflections

## M1: Serialization / Deserialization

### Summary
185 lines of code total. Key challenges included:

1. **Avoiding double-encoding in recursive structures**: Biggest problem I've encountered while working on my implementation. Initially, calling stringify at every recursion level caused exponential string growth for nested objects. Managed to solve this by separating serializeHelper (returns objects) from serialize (calls stringify once at the end).

2. **Handling special JS values**: NaN, infinity, etc. can't be directly represented in JSON. Solved by using string markers (e.g., `"NaN"`) and a wrapper that's type-tagged: `{type: ..., value: ...}`.

3. **Deserializing functions**: Haven't seen the eval function beforehand, so this was new. The main issue was that functions need to be reconstructed from their string representation, which this one  (`eval('(' + fnString + ')')`) solved.  Also, handles both arrow functions and regular function declarations. Learned why one must use paranthesis in this case, to force expression evaluation. Yay!

### Correctness & Performance Characterization

*Correctness*: 46 tests total (5 student tests + 5 scenarios + 36 provided tests); these take ~0.6 seconds to execute. This includes objects with nested structures, all primitive types (number, string, boolean, null, undefined, BigInt), special values (NaN, Infinity), complex objects (Date, Error, Array, Object), and functions.

*Performance*: Mentioned in the latency portion of package.json, same with dev machine specification. But: 

**Local Development (macOS, Apple M2):**
| Workload | Serialize (μs) | Deserialize (μs) | Total (μs) |
|----------|----------------|------------------|------------|
| Base Types (T2) | 3.46 | 7.18 | 10.64 |
| Functions (T3) | 1.73 | 4.67 | 6.40 |
| Complex Structures (T4) | 16.53 | 27.75 | 44.28 |

**AWS EC2 (Linux x64, Node v20.20.0):**
| Workload | Serialize (μs) | Deserialize (μs) | Total (μs) |
|----------|----------------|------------------|------------|
| Base Types (T2) | 7.34 | 12.42 | 19.76 |
| Functions (T3) | 4.79 | 9.21 | 14.00 |
| Complex Structures (T4) | 24.47 | 37.36 | 61.83 |


## M2#

## Summary
My implementation is based on 4 components, with appx 593 lines of code:
- `comm.js`: HTTP client for sending serialized messages to remote nodes
- `node.js`: HTTP server for handling incoming requests and routing them to services
- `status.js`: Service for node configuration and status information
- `routes.js`: Service registry for storing and retrieving services by name

Key challenges included:
1. **Callbacks**: Nesting callbacks for sequential operations quickly became messy and hard to debug. I dealt with this by being very consistent with the error-first callback pattern & breaking things into smaller helper functions where possible.
2. **Getting serialization right on both ends**: Messages need to be serialized before sending and deserialized when received, and it's easy to forget one side or double-serialize by accident. Took some trial and error to get `util.serialize`/`util.deserialize` working consistently between the client and server.
3. **Parsing the URL path correctly**: The server needs to extract the gid, service name, and method from paths like `/<gid>/<service>/<method>`. Edge cases like empty strings or missing parts caused some headaches until I've added proper validation.
4. **Handling network errors**: Connections can fail, time out, or return unexpected responses - had to make sure every error path actually called the callback with an error instead of silently failing or crashing.


## Correctness & Performance Characterization
*Correctness*: Wrote 5 tests in `m2.student.test.js`; cover status retrieval, routes registration/removal, and comm message sending.

*Performance*: Characterized using `test/m2.comm.benchmark.js` (1000 iterations per benchmark). Results are in `package.json`.

**Local development (macOS):**
- comm sequential (status.get nid): 6,311 req/s, 145 μs avg latency
- comm sequential (status.get sid): 9,909 req/s, 93 μs avg latency
- comm parallel: 14,250 req/s, 5.72 ms avg
- RPC sequential: ~673 req/s, ~1.46 ms avg 

**AWS EC2 (Ubuntu, Linux x64, Node v20.20.0):**
- comm sequential (status.get nid): 1,886 req/s, 475 μs avg latency
- comm sequential (status.get sid): 2,771 req/s, 320 μs avg latency
- comm parallel (c=100): 6,103 req/s, 13.09 ms avg
- RPC benchmark did not complete on this run (remote node failed to start within timeout).


## Key Feature
`createRPC` takes a function that exists on one machine and makes it callable from a different machine over the network. The caller doesn't need to know where the function actually runs, they just call it like any other function, and the result comes back. Under the hood, it wraps the original function in a way that, when called remotely, sends a message back to the original machine saying "run this function with these inputs." The original machine executes the function locally, then sends the result back over the network.

This is useful since it lets you distribute work across multiple machines while keeping the code simple. I.e., the caller just calls a function, and the networking details are handled automatically.

## M3: Node Groups & Gossip Protocols

### Summary
My implementation comprises 6 new software components, totaling approximately 250 added lines of code over the previous implementation. Key challenges included:

1. **Service instantiation via closures**: Each distributed service (comm, status, groups, routes) needs to be a factory function that captures a group-specific context. Getting `local.groups.put` to dynamically create `distribution[gid]` with properly instantiated services required careful wiring between the local groups service and `all/all.js`'s `setup` function.

2. **Concurrent fan-out in all.comm.send**: Sending messages to all nodes in a group and collecting responses required careful counting to know when all responses have arrived. Errors and values need to be collected in separate maps keyed by SID, and the callback only fires once all nodes have responded.

3. **Extending comm/routes/node.js for GID-aware routing**: The path format changed from `/<service>/<method>` to `/<gid>/<service>/<method>`, which required coordinated updates across three files. `routes.get` now accepts both a string and an `{service, gid}` object, and the node server extracts the gid to route to either local or distributed services.

### Correctness & Performance Characterization
*Correctness*: 5 student tests covering local.groups CRUD, distributed comm fan-out, routes config formats, and distributed status aggregation. The provided test suite covers all.comm, all.status, all.groups, and all.routes with multi-node setups.

*Performance*: Spawn times depend on the reference library implementation (used via skip.sh for E1).

### Key Feature
The point of a gossip protocol is scalability. If a node sends a message to all other nodes in its group, the communication cost is O(n) per message, which becomes a bottleneck at scale. With gossip, each node only contacts a random subset (e.g., log(n) nodes), and those nodes forward the message to their own random subsets. This achieves eventual dissemination with O(log(n)) communication per node per round. The trade-off is that delivery is probabilistic and not immediate, but for non-critical information like health checks or membership updates, this is an excellent trade-off that allows the system to scale to thousands of nodes.
