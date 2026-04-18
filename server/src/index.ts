import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import camerasRoutes from './routes/cameras.js';
import eventsRoutes from './routes/events.js';
import usersRoutes from './routes/users.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
  }),
);
app.use(express.json({ limit: '64kb' }));
app.use(pinoHttp({ logger }));

// Global rate limit to mitigate enumeration/scraping attempts. Login has a
// tighter limit applied in routes/auth.ts.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cameras', camerasRoutes);
app.use('/api/events', eventsRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Suspolcctvreg API listening');
});
