import { Router } from 'express';
import mongoose from 'mongoose';
import User, { ROLES } from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { ADMIN_ROLES, APPROVER_ROLES } from '../utils/roles.js';
import { teamUserFilter, getSubordinateIds } from '../utils/leave.js';

const router = Router();
router.use(protect);

const populateUser = (q) => q.populate('department', 'name code').populate('reportsTo', 'name email role');

// Team of the current approver (everyone for admin/GM)
router.get(
  '/team',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const filter = { ...(await teamUserFilter(req.user)), isActive: true };
    if (!filter._id) filter._id = { $ne: req.user._id };
    const users = await populateUser(User.find(filter).sort('name'));
    res.json(users);
  })
);

// Possible reporting managers
router.get(
  '/approvers',
  ah(async (_req, res) => {
    const users = await User.find({ isActive: true, role: { $in: APPROVER_ROLES } }).select('name role email department').sort('name');
    res.json(users);
  })
);

router.get(
  '/',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const { search, role, department, status } = req.query;
    const filter = {};
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }, { designation: rx }];
    }
    if (role) filter.role = role;
    if (department && mongoose.isValidObjectId(department)) filter.department = department;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    const users = await populateUser(User.find(filter).sort('name'));
    res.json(users);
  })
);

const pickFields = (body) => {
  const allowed = ['name', 'email', 'employeeId', 'role', 'department', 'reportsTo', 'designation', 'phone', 'gender', 'joinDate', 'isActive'];
  const out = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k] === '' && ['department', 'reportsTo', 'employeeId'].includes(k) ? null : body[k];
  return out;
};

router.post(
  '/',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const data = pickFields(req.body);
    if (!req.body.password || req.body.password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (data.role && !ROLES.includes(data.role)) throw new HttpError(400, 'Invalid role');
    if (data.role === 'admin' && req.user.role !== 'admin') throw new HttpError(403, 'Only administrators can create administrators');
    if (data.employeeId === null) delete data.employeeId;
    const user = await User.create({ ...data, password: req.body.password });
    await AuditLog.create({ action: 'user.create', actor: req.user._id, target: user._id, details: { role: user.role } });
    res.status(201).json(await populateUser(User.findById(user._id)));
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const user = await populateUser(User.findById(req.params.id));
    if (!user) throw new HttpError(404, 'User not found');
    const allowed =
      ADMIN_ROLES.includes(req.user.role) ||
      String(user._id) === String(req.user._id) ||
      (await getSubordinateIds(req.user._id)).some((id) => String(id) === String(user._id));
    if (!allowed) throw new HttpError(403, 'Not allowed');
    res.json(user);
  })
);

router.put(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const data = pickFields(req.body);
    if (data.role && !ROLES.includes(data.role)) throw new HttpError(400, 'Invalid role');
    if ((data.role === 'admin' || user.role === 'admin') && req.user.role !== 'admin' && data.role !== undefined && data.role !== user.role) {
      throw new HttpError(403, 'Only administrators can change administrator roles');
    }
    if (data.reportsTo && String(data.reportsTo) === String(user._id)) throw new HttpError(400, 'An employee cannot report to themselves');
    if (data.reportsTo) {
      const subs = await getSubordinateIds(user._id);
      if (subs.some((id) => String(id) === String(data.reportsTo))) throw new HttpError(400, 'This would create a circular reporting line');
    }
    if (data.employeeId === null) delete data.employeeId;
    Object.assign(user, data);
    if (req.body.password) {
      if (req.body.password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      user.password = req.body.password;
    }
    await user.save();
    await AuditLog.create({ action: 'user.update', actor: req.user._id, target: user._id, details: { fields: Object.keys(data) } });
    res.json(await populateUser(User.findById(user._id)));
  })
);

// Soft delete: deactivate
router.delete(
  '/:id',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new HttpError(400, 'You cannot deactivate your own account');
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) throw new HttpError(404, 'User not found');
    await AuditLog.create({ action: 'user.deactivate', actor: req.user._id, target: user._id });
    res.json({ message: 'Employee deactivated' });
  })
);

export default router;
