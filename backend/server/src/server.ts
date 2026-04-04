import express, { type Request } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './lib/config.js';
import { initFirebaseAdmin } from './lib/firebase.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { JSON_BODY_LIMIT } from './middleware/uploadLimits.js';
import { registerScrapeScheduler } from './queues/scrapeScheduler.js';
import { attachLiveFeedServer } from './services/feedSocket.js';
import { apiRouter, rootRouter } from './routes/index.js';

try {
  initFirebaseAdmin();
} catch (err) {
  logger.fatal({ err }, 'firebase_admin_init_failed');
  process.exit(1);
}

const app = express();

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req: Request, _res, buf) => {
      const path = req.originalUrl?.split('?')[0] ?? '';
      if (path.endsWith('/webhooks/agentmail')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(requestIdMiddleware);
app.use(httpLogger());

app.use('/', rootRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: '/ws/feed' });
attachLiveFeedServer(wss);

const listenOptions: { port: number; host?: string } = { port: config.port };
if (config.host) {
  listenOptions.host = config.host;
}

httpServer.listen(listenOptions, () => {
  logger.info(
    {
      port: config.port,
      host: config.host ?? '(default)',
      env: config.nodeEnv,
      apiBaseUrl: config.apiBaseUrl,
    },
    'http_listen'
  );
  void registerScrapeScheduler().catch((err) => {
    logger.warn({ err }, 'scrape_scheduler_register_failed');
  });
});
