import { config } from './lib/config.js';
import { initFirebaseAdmin } from './lib/firebase.js';
import { logger } from './lib/logger.js';
import { registerWorkflowWorkers, WORKFLOW_QUEUE_LIST } from './queues/workflowWorkers.js';

try {
  initFirebaseAdmin();
} catch (err) {
  logger.fatal({ err }, 'firebase_admin_init_failed');
  process.exit(1);
}

if (!config.redisUrl) {
  logger.fatal('Worker requires REDIS_URL');
  process.exit(1);
}

const workers = registerWorkflowWorkers();

logger.info(
  { queues: [...WORKFLOW_QUEUE_LIST], env: config.nodeEnv, workerCount: workers.length },
  'workflow_workers_started'
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker_shutdown');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
