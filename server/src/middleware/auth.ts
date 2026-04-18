import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type SessionClaims } from '../auth/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionClaims;
  }
}

const ROLE_ORDER: Record<SessionClaims['role'], number> = {
  viewer: 0,
  user: 1,
  admin: 2,
};

function readToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  if (scheme === 'Bearer' && headerToken) return headerToken;
  // EventSource cannot set custom headers, so fall back to ?token= for SSE.
  const query = req.query.token;
  if (typeof query === 'string' && query) return query;
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(minRole: SessionClaims['role']) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (ROLE_ORDER[req.user.role] < ROLE_ORDER[minRole]) {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }
    if (req.user.status !== 'approved') {
      res.status(403).json({ error: 'Account pending approval' });
      return;
    }
    next();
  };
}
