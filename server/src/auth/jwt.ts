import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface SessionClaims {
  sub: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'pending' | 'approved';
}

export function issueToken(claims: SessionClaims): string {
  return jwt.sign(claims, config.jwtSecret, {
    expiresIn: config.jwtTtlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): SessionClaims {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof payload === 'string') throw new Error('Invalid token payload');
  return payload as unknown as SessionClaims;
}
