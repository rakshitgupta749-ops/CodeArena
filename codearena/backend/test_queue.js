require('dotenv').config();
const { codeExecutionQueue, queueEvents } = require('./src/queues/codeExecutionQueue');

// Reusing the queue and queueEvents from codeExecutionQueue.js

async function run() {
  console.log("Adding 20 jobs to the queue...");
  const promises = [];
  
  for (let i = 0; i < 20; i++) {
    const job = codeExecutionQueue.add('test-run', {
      code: 'public class Solution { public static void main(String[] args) { System.out.println("Hello, World!"); } }',
      testCases: [{ input: '', expectedOutput: 'Hello, World!', isHidden: false }],
      language: 'java'
    });
    promises.push(job.then(j => j.waitUntilFinished(queueEvents)));
  }

  const startTime = Date.now();
  await Promise.all(promises);
  const endTime = Date.now();

  console.log(`All 20 jobs completed in ${(endTime - startTime)/1000} seconds.`);
  process.exit(0);
}

run().catch(console.error);
