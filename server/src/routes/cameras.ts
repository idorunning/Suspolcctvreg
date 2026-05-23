import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { cameraBus } from '../events/bus.js';
import { appendEvent } from '../repos/events.js';
import {
  deleteCameraRow,
  findCameraById,
  insertCamera,
  listCameras,
  updateCameraRow,
  verifyCameraRow,
} from '../repos/cameras.js';
import { cameraCreateSchema, cameraUpdateSchema } from '../validation.js';

const router = Router();

router.get('/', requireAuth, requireRole('viewer'), async (_req, res, next) => {
  try {
    res.json(await listCameras());
  } catch (err) {
    next(err);
  }
});

router.get('/stream', requireAuth, requireRole('viewer'), async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const snapshot = await listCameras();
    res.write(`event: snapshot\n`);
    res.write(`data: ${JSON.stringify({ type: 'snapshot', cameras: snapshot })}\n\n`);

    const unsubscribe = cameraBus.subscribe((event) => {
      const payload =
        event.kind === 'delete'
          ? { type: 'delete', id: event.id }
          : { type: 'upsert', camera: event.camera };
      res.write(`event: ${event.kind}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('user'), async (req, res, next) => {
  try {
    const input = cameraCreateSchema.parse(req.body);
    const camera = await insertCamera(input, req.user!.sub, req.user!.email);
    await appendEvent({
      action: 'camera_added',
      userId: req.user!.sub,
      userEmail: req.user!.email,
      details: `Added ${camera.type} camera at ${camera.latitude},${camera.longitude}`,
    });
    cameraBus.publish({ kind: 'upsert', camera });
    res.status(201).json(camera);
  } catch (err) {
    next(err);
  }
});

async function canModify(cameraId: string, userSub: string, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const camera = await findCameraById(cameraId);
  return camera?.addedBy === userSub;
}

router.patch('/:id', requireAuth, requireRole('user'), async (req, res, next) => {
  try {
    const allowed = await canModify(req.params.id, req.user!.sub, req.user!.role);
    if (!allowed) {
      res.status(403).json({ error: 'Cannot modify a camera created by someone else' });
      return;
    }
    const patch = cameraUpdateSchema.parse(req.body);
    const camera = await updateCameraRow(req.params.id, patch);
    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }
    await appendEvent({
      action: 'camera_amended',
      userId: req.user!.sub,
      userEmail: req.user!.email,
      details: `Amended camera id=${camera.id}`,
    });
    cameraBus.publish({ kind: 'upsert', camera });
    res.json(camera);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify', requireAuth, requireRole('user'), async (req, res, next) => {
  try {
    const camera = await verifyCameraRow(req.params.id);
    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }
    await appendEvent({
      action: 'camera_amended',
      userId: req.user!.sub,
      userEmail: req.user!.email,
      details: `Verified camera id=${camera.id}`,
    });
    cameraBus.publish({ kind: 'upsert', camera });
    res.json(camera);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('user'), async (req, res, next) => {
  try {
    const allowed = await canModify(req.params.id, req.user!.sub, req.user!.role);
    if (!allowed) {
      res.status(403).json({ error: 'Cannot delete a camera created by someone else' });
      return;
    }
    const removed = await deleteCameraRow(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }
    await appendEvent({
      action: 'camera_removed',
      userId: req.user!.sub,
      userEmail: req.user!.email,
      details: `Deleted camera id=${req.params.id}`,
    });
    cameraBus.publish({ kind: 'delete', id: req.params.id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
