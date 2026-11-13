const { Queue, Worker, QueueEvents } = require('bullmq');
const { executeCode } = require('../services/codeExecutor');
const IORedis = require('ioredis');
const net = require('net');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queueName = 'code-execution';
const CONCURRENCY_LIMIT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 5;

let isRedisAvailable = false;
let realQueue = null;
let realQueueEvents = null;
let realWorker = null;
let connection = null;

// Helper to quickly probe if Redis host and port are listening
function pingPort(host, port, timeout = 500) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeout);
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('timeout', () => {
      s.destroy();
      resolve(false);
    });
    s.once('error', () => {
      s.destroy();
      resolve(false);
    });
    s.connect(port, host);
  });
}

async function initQueue() {
  let host = '127.0.0.1';
  let port = 6379;

  try {
    const parsed = new URL(REDIS_URL.includes('://') ? REDIS_URL : `redis://${REDIS_URL}`);
    host = parsed.hostname || '127.0.0.1';
    port = parseInt(parsed.port, 10) || 6379;
  } catch {
    // fallback to default host and port
  }

  const isOnline = await pingPort(host, port);
  if (!isOnline) {
    console.warn(`[Queue] Redis is not running on ${host}:${port}. Code execution queue will run in direct fallback mode.`);
    isRedisAvailable = false;
    return;
  }

  try {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 5) return null; // stop reconnecting if down
        return Math.min(times * 200, 1000);
      },
    });

    connection.on('error', (err) => {
      if (isRedisAvailable) {
        console.warn(`[Queue] Redis connection error: ${err.message}`);
        isRedisAvailable = false;
      }
    });

    connection.on('connect', () => {
      console.log(`[Queue] Connected to Redis on ${host}:${port}.`);
      isRedisAvailable = true;
    });

    realQueue = new Queue(queueName, { connection });
    realQueueEvents = new QueueEvents(queueName, { connection });
    realWorker = new Worker(
      queueName,
      async (job) => {
        const { code, testCases, language } = job.data;
        return await executeCode(code, testCases, language);
      },
      { connection, concurrency: CONCURRENCY_LIMIT }
    );

    realWorker.on('completed', (job) => {
      console.log(`Code Execution Job ${job.id} has completed!`);
    });

    realWorker.on('failed', (job, err) => {
      console.error(`Code Execution Job ${job.id} has failed with ${err.message}`);
    });

    realWorker.on('error', () => {});
    realQueueEvents.on('error', () => {});
    realQueue.on('error', () => {});

    isRedisAvailable = true;
  } catch (err) {
    console.warn('[Queue] Failed to initialize Redis queue, using direct execution mode:', err.message);
    isRedisAvailable = false;
  }
}

// Initialize on module load
initQueue();

// Proxy queue object that gracefully falls back if Redis is offline
const codeExecutionQueue = {
  add: async (jobName, data) => {
    if (isRedisAvailable && realQueue) {
      try {
        return await realQueue.add(jobName, data);
      } catch (err) {
        console.warn('[Queue] Redis queue add failed, falling back to direct execution:', err.message);
      }
    }

    // Direct in-process execution fallback
    return {
      id: `direct-${Date.now()}`,
      waitUntilFinished: async () => {
        return await executeCode(data.code, data.testCases, data.language);
      },
    };
  },
};

const queueEventsProxy = {
  get instance() {
    return realQueueEvents;
  },
};

module.exports = {
  codeExecutionQueue,
  queueEvents: queueEventsProxy,
};
