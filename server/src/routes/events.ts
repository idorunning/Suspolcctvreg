import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listEvents } from '../repos/events.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listEvents());
  } catch (err) {
    next(err);
  }
});

export default router;
