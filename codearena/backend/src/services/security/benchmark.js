const http = require('http');

const PORT = 5005;
const REQUESTS = 200;
const CONCURRENCY = 20;

const payload = JSON.stringify({ text: "O(n) is the optimal time complexity here" });

const options = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/predict',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

function makeRequest() {
    return new Promise((resolve, reject) => {
        const start = process.hrtime.bigint();
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                const end = process.hrtime.bigint();
                const latencyMs = Number(end - start) / 1e6;
                resolve(latencyMs);
            });
        });
        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
    });
}

async function runBenchmark() {
    console.log(`Starting benchmark against ML daemon (Port: ${PORT})`);
    console.log(`Total Requests: ${REQUESTS}, Concurrency: ${CONCURRENCY}`);

    let active = 0;
    let completed = 0;
    const latencies = [];

    const startTotal = Date.now();

    return new Promise((resolve) => {
        function next() {
            if (completed === REQUESTS) {
                const endTotal = Date.now();
                console.log(`Benchmark completed in ${endTotal - startTotal}ms\n`);
                
                latencies.sort((a, b) => a - b);
                const sum = latencies.reduce((a, b) => a + b, 0);
                const avg = sum / latencies.length;
                const min = latencies[0];
                const max = latencies[latencies.length - 1];
                const p50 = latencies[Math.floor(latencies.length * 0.50)];
                const p95 = latencies[Math.floor(latencies.length * 0.95)];
                const p99 = latencies[Math.floor(latencies.length * 0.99)];
                
                console.log(`--- Latency Results (ms) ---`);
                console.log(`Min:  ${min.toFixed(2)} ms`);
                console.log(`Avg:  ${avg.toFixed(2)} ms`);
                console.log(`p50:  ${p50.toFixed(2)} ms`);
                console.log(`p95:  ${p95.toFixed(2)} ms`);
                console.log(`p99:  ${p99.toFixed(2)} ms`);
                console.log(`Max:  ${max.toFixed(2)} ms`);
                
                resolve();
                return;
            }

            while (active < CONCURRENCY && (active + completed) < REQUESTS) {
                active++;
                makeRequest().then(lat => {
                    latencies.push(lat);
                    completed++;
                    active--;
                    next();
                }).catch(e => {
                    console.error("Request failed:", e.message);
                    completed++;
                    active--;
                    next();
                });
            }
        }
        
        next();
    });
}

runBenchmark().catch(console.error);
