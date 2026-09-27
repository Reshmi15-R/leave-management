import { Router } from 'express';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { ADMIN_ROLES } from '../utils/roles.js';

const router = Router();
router.use(protect);

router.get(
  '/',
  ah(async (_req, res) => {
    const [departments, counts] = await Promise.all([
      Department.find().populate('head', 'name email').sort('name').lean(),
      User.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$department', count: { $sum: 1 } } }]),
    ]);
    const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json(departments.map((d) => ({ ...d, employeeCount: byId[String(d._id)] || 0 })));
  })
);

const pick = ({ name, code, description, head, isActive }) => ({
  name, code, description, isActive, head: head === '' ? null : head,
});

router.post(
  '/',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const dep = await Department.create(pick(req.body));
    res.status(201).json(dep);
  })
);

router.put(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const data = Object.fromEntries(Object.entries(pick(req.body)).filter(([, v]) => v !== undefined));
    const dep = await Department.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!dep) throw new HttpError(404, 'Department not found');
    res.json(dep);
  })
);

router.delete(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const inUse = await User.countDocuments({ department: req.params.id, isActive: true });
    if (inUse) throw new HttpError(400, `Cannot delete: ${inUse} active employee(s) belong to this department`);
    const dep = await Department.findByIdAndDelete(req.params.id);
    if (!dep) throw new HttpError(404, 'Department not found');
    res.json({ message: 'Department deleted' });
  })
);

export default router;
