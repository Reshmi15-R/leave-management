import { Router } from 'express';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { ADMIN_ROLES } from '../utils/roles.js';
import { toUTCDate } from '../utils/dates.js';

const router = Router();
router.use(protect);

router.get('/', ah(async (_req, res) => res.json(await Settings.get())));

router.put(
  '/',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const s = await Settings.get();
    const fields = ['organizationName', 'workingDays', 'allowNegativeBalance', 'secondLevelApprovalThreshold', 'maxBackdatedDays', 'maxFutureDays'];
    for (const f of fields) if (req.body[f] !== undefined) s[f] = req.body[f];
    if (Array.isArray(req.body.holidays)) {
      s.holidays = req.body.holidays.map((h) => {
        const date = toUTCDate(h.date);
        if (!date || !h.name) throw new HttpError(400, 'Each holiday needs a valid date and name');
        return { date, name: h.name };
      });
      s.holidays.sort((a, b) => a.date - b.date);
    }
    await s.save();
    await AuditLog.create({ action: 'settings.update', actor: req.user._id, details: { fields: Object.keys(req.body) } });
    res.json(s);
  })
);

router.get(
  '/audit',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await AuditLog.find().sort('-createdAt').limit(limit).populate('actor', 'name role').populate('target', 'name');
    res.json(logs);
  })
);

export default router;
