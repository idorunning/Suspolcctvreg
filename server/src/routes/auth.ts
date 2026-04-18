import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ldapAuthenticate } from '../auth/ldap.js';
import { issueToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { appendEvent } from '../repos/events.js';
import { createUser, findUserByEmail, findUserById, updateUser } from '../repos/users.js';
import { loginSchema } from '../validation.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();

    const ldapUser = await ldapAuthenticate(normalizedEmail, password);
    if (!ldapUser) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    let user = await findUserByEmail(ldapUser.email);
    if (!user) {
      const isBootstrapAdmin =
        config.adminBootstrapEmail && ldapUser.email === config.adminBootstrapEmail;
      const hasUserGroup =
        config.ldap.userGroupDns.length > 0 &&
        ldapUser.groupDns.some((dn) => config.ldap.userGroupDns.includes(dn));
      user = await createUser({
        email: ldapUser.email,
        displayName: ldapUser.displayName ?? null,
        role: isBootstrapAdmin ? 'admin' : hasUserGroup ? 'user' : 'viewer',
        status: isBootstrapAdmin ? 'approved' : 'pending',
      });
    } else if (
      config.adminBootstrapEmail &&
      ldapUser.email === config.adminBootstrapEmail &&
      (user.role !== 'admin' || user.status !== 'approved')
    ) {
      user = (await updateUser(user.id, { role: 'admin', status: 'approved' })) ?? user;
    }

    const token = issueToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    await appendEvent({
      action: 'login',
      userId: user.id,
      userEmail: user.email,
    });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.user) {
      await appendEvent({
        action: 'logout',
        userId: req.user.sub,
        userEmail: req.user.email,
      });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.user ? await findUserById(req.user.sub) : null;
    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
