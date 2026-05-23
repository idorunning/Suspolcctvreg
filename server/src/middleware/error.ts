import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal error';
  const status = typeof (err as { status?: number })?.status === 'number'
    ? (err as { status: number }).status
    : 500;
  res.status(status).json({ error: message });
}
