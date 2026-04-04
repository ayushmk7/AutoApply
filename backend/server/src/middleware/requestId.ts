import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers['x-request-id'];
  const fromHeader = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  const id = fromHeader ?? randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
