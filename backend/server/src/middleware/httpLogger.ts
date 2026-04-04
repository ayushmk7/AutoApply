import type { HttpLogger } from 'pino-http';
import { pinoHttp } from 'pino-http';
import type { Request, Response } from 'express';
import { logger } from '../lib/logger.js';

export function httpLogger(): HttpLogger<Request, Response> {
  return pinoHttp({
    logger,
    genReqId: (req: Request, res: Response) => {
      const id = req.requestId;
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req: Request) => ({ requestId: req.requestId }),
  });
}
