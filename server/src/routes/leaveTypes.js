import { Router } from 'express';
import LeaveType from '../models/LeaveType.js';
import LeaveRequest from '../models/LeaveRequest.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const router = Router();
router.use(protect);

router.get(
  '/',
  ah(async (req, res) => {
    const filter = req.query.all === 'true' && ADMIN_ROLES.includes(req.user.role) ? {} : { isActive: true };
    res.json(await LeaveType.find(filter).sort('name'));
  })
);

const FIELDS = [
  'name', 'code', 'description', 'color', 'defaultDays', 'roleEntitlements', 'isPaid', 'carryForward',
  'maxCarryForward', 'allowHalfDay', 'requiresDocument', 'docRequiredAfterDays', 'minNoticeDays',
  'maxConsecutiveDays', 'gender', 'isActive',
];
const pick = (body) => {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.roleEntitlements) {
    for (const [k, v] of Object.entries(out.roleEntitlements)) {
      out.roleEntitlements[k] = v === '' || v === null ? null : Number(v);
    }
  }
  return out;
};

router.post(
  '/',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const type = await LeaveType.create(pick(req.body));
    await AuditLog.create({ action: 'leaveType.create', actor: req.user._id, details: { name: type.name } });
    res.status(201).json(type);
  })
);

router.put(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const type = await LeaveType.findById(req.params.id);
    if (!type) throw new HttpError(404, 'Leave type not found');
    Object.assign(type, pick(req.body));
    await type.save();
    await AuditLog.create({ action: 'leaveType.update', actor: req.user._id, details: { name: type.name } });
    res.json(type);
  })
);

router.delete(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const used = await LeaveRequest.countDocuments({ leaveType: req.params.id });
    if (used) {
      await LeaveType.findByIdAndUpdate(req.params.id, { isActive: false });
      return res.json({ message: 'Leave type has history, so it was deactivated instead of deleted' });
    }
    const type = await LeaveType.findByIdAndDelete(req.params.id);
    if (!type) throw new HttpError(404, 'Leave type not found');
    res.json({ message: 'Leave type deleted' });
  })
);

export default router;
