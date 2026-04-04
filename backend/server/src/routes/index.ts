import { Router } from 'express';
import { applicationsRouter } from './applications.js';
import { authRouter } from './auth.js';
import { feedRouter } from './feed.js';
import { healthRouter, healthzHandler, readyzHandler } from './health.js';
import { jobsRouter } from './jobs.js';
import { metricsRouter } from './metrics.js';
import { profileRouter } from './profile.js';
import { sheetsRouter } from './sheets.js';
import { webhooksRouter } from './webhooks.js';

export const rootRouter = Router();
rootRouter.get('/healthz', healthzHandler);
rootRouter.get('/readyz', readyzHandler);
rootRouter.use('/health', healthRouter);

export const apiRouter = Router();
apiRouter.get('/healthz', healthzHandler);
apiRouter.get('/readyz', readyzHandler);
apiRouter.use('/health', healthRouter);
apiRouter.use('/metrics', metricsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/sheets', sheetsRouter);
apiRouter.use('/', feedRouter);
apiRouter.use('/webhooks', webhooksRouter);
