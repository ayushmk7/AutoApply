import { Router } from 'express';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/httpError.js';
import { getWorkflowMetricsSnapshot } from '../services/workflowMetrics.js';

export const metricsRouter = Router();

metricsRouter.get('/', async (req, res, next) => {
  try {
    if (config.metricsApiKey) {
      const key = (req.headers['x-metrics-key'] as string | undefined)?.trim();
      if (key !== config.metricsApiKey) {
        next(new HttpError(401, 'Unauthorized', 'UNAUTHORIZED'));
        return;
      }
    }
    const body = await getWorkflowMetricsSnapshot();
    res.json(body);
  } catch (err) {
    next(err);
  }
});
