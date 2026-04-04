import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error & { status?: number; code?: string; details?: unknown },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    logger.warn(
      { err, requestId: req.requestId, status: err.status, code: err.code },
      err.message
    );
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
      requestId: req.requestId,
    });
    return;
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  logger.error(
    { err, requestId: req.requestId, status },
    err.message || 'internal_error'
  );
  res.status(status).json({
    error: status === 500 ? 'internal_server_error' : err.message,
    ...(typeof err.code === 'string' ? { code: err.code } : {}),
    ...(err.details !== undefined ? { details: err.details } : {}),
    requestId: req.requestId,
  });
}
