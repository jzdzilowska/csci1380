const distribution = require('../distribution.js');

const NUM_SPAWNS = 5;
const BASE_PORT = 9000;

function benchmarkSpawn() {
  const dist = distribution({ip: '127.0.0.1', port: 1234});

  dist.node.start(() => {
    console.log('Local node started on port 1234');
    const times = [];
    let completed = 0;

    function spawnNext(i) {
      if (i >= NUM_SPAWNS) {
        // Print results
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        console.log(`\n--- Spawn Benchmark Results (${NUM_SPAWNS} spawns) ---`);
        console.log(`Average latency: ${avg.toFixed(2)} ms`);
        console.log(`Min: ${min.toFixed(2)} ms, Max: ${max.toFixed(2)} ms`);
        console.log(`Throughput: ${(1000 / avg).toFixed(2)} spawns/s`);
        console.log(`Individual times (ms): [${times.map((t) => t.toFixed(2)).join(', ')}]`);

        // Stop all spawned nodes, then stop local
        let stopped = 0;
        for (let j = 0; j < NUM_SPAWNS; j++) {
          const node = {ip: '127.0.0.1', port: BASE_PORT + j};
          dist.local.comm.send([], {node, service: 'status', method: 'stop'}, () => {
            stopped++;
            if (stopped === NUM_SPAWNS) {
              dist.local.status.stop(() => {
                process.exit(0);
              });
            }
          });
        }
        return;
      }

      const nodeConfig = {ip: '127.0.0.1', port: BASE_PORT + i};
      const start = performance.now();
      dist.local.status.spawn(nodeConfig, (e, v) => {
        const elapsed = performance.now() - start;
        if (e) {
          console.error(`Spawn ${i} failed:`, e.message);
        } else {
          times.push(elapsed);
          console.log(`Spawn ${i} (port ${BASE_PORT + i}): ${elapsed.toFixed(2)} ms`);
        }
        spawnNext(i + 1);
      });
    }

    spawnNext(0);
  });
}

benchmarkSpawn();
