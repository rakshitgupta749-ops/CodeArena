const { Queue, Worker, QueueEvents } = require('bullmq');
const { executeCode } = require('../services/codeExecutor');
const IORedis = require('ioredis');

// Redis Connection configuration
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null, // Required by bullmq
});

const queueName = 'code-execution';

// Create a new Queue
const codeExecutionQueue = new Queue(queueName, { connection });

// QueueEvents allows us to wait for jobs to finish
const queueEvents = new QueueEvents(queueName, { connection });

// Maximum number of concurrent piston executions to prevent overloading
const CONCURRENCY_LIMIT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 5;

// Create the Worker
const worker = new Worker(
  queueName,
  async (job) => {
    const { code, testCases, language } = job.data;
    // Execute the code via Piston
    const result = await executeCode(code, testCases, language);
    return result;
  },
  {
    connection,
    concurrency: CONCURRENCY_LIMIT,
  }
);

worker.on('completed', (job) => {
  console.log(`Code Execution Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`Code Execution Job ${job.id} has failed with ${err.message}`);
});

module.exports = {
  codeExecutionQueue,
  queueEvents,
};
