import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { appendEvent } from '../repos/events.js';
import { deleteUser, listUsers, updateUser } from '../repos/users.js';
import { userPatchSchema } from '../validation.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const patch = userPatchSchema.parse(req.body);
    const updated = await updateUser(req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (req.user) {
      await appendEvent({
        action: 'user_updated',
        userId: req.user.sub,
        userEmail: req.user.email,
        details: `Updated user ${updated.email}: ${JSON.stringify(patch)}`,
      });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user?.sub === req.params.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }
    const removed = await deleteUser(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (req.user) {
      await appendEvent({
        action: 'user_deleted',
        userId: req.user.sub,
        userEmail: req.user.email,
        details: `Deleted user id=${req.params.id}`,
      });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
