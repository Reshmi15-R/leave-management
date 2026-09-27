import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { APPROVER_ROLES, OVERRIDE_ROLES, ADMIN_ROLES } from '../utils/roles.js';
import { getBalances, getBalancesForUsers, ensureBalance, canManageUser, teamUserFilter } from '../utils/leave.js';

const router = Router();
router.use(protect);

const yearOf = (q) => Number(q) || new Date().getFullYear();

router.get('/me', ah(async (req, res) => res.json(await getBalances(req.user, yearOf(req.query.year)))));

router.get(
  '/team',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const year = yearOf(req.query.year);
    const filter = { ...(await teamUserFilter(req.user)), isActive: true };
    if (!filter._id) filter._id = { $ne: req.user._id };
    const users = await User.find(filter).populate('department', 'name code').sort('name');
    const byUser = await getBalancesForUsers(users, year);
    res.json(users.map((u) => ({ user: u, balances: byUser.get(String(u._id)) })));
  })
);

router.get(
  '/user/:id',
  ah(async (req, res) => {
    const isSelf = String(req.params.id) === String(req.user._id);
    if (!isSelf && !(await canManageUser(req.user, req.params.id))) throw new HttpError(403, 'Not allowed');
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(await getBalances(user, yearOf(req.query.year)));
  })
);

// Manual credit/debit of a team member's balance
router.post(
  '/adjust',
  authorize(...OVERRIDE_ROLES),
  ah(async (req, res) => {
    const { userId, leaveTypeId, reason } = req.body;
    const amount = Number(req.body.amount);
    const year = yearOf(req.body.year);
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(leaveTypeId)) throw new HttpError(400, 'Employee and leave type are required');
    if (!amount || Number.isNaN(amount)) throw new HttpError(400, 'Enter a non-zero adjustment amount');
    if (Math.abs(amount * 2) % 1 !== 0) throw new HttpError(400, 'Adjustments must be in steps of 0.5 days');
    if (!String(reason || '').trim()) throw new HttpError(400, 'A reason is required for balance adjustments');
    if (!(await canManageUser(req.user, userId))) throw new HttpError(403, 'This employee is not in your team');

    const [user, type] = await Promise.all([User.findById(userId), LeaveType.findById(leaveTypeId)]);
    if (!user || !type) throw new HttpError(404, 'Employee or leave type not found');
    const bal = await ensureBalance(user, type, year);
    bal.adjusted += amount;
    bal.history.push({ kind: 'adjustment', amount, reason, by: req.user._id });
    await bal.save();
    await AuditLog.create({
      action: 'balance.adjust',
      actor: req.user._id,
      target: user._id,
      details: { leaveType: type.name, year, amount, reason, newAvailable: bal.available },
    });
    const out = bal.toJSON();
    out.leaveType = type;
    res.json(out);
  })
);

router.get(
  '/history/:userId/:leaveTypeId',
  ah(async (req, res) => {
    const { userId, leaveTypeId } = req.params;
    const isSelf = String(userId) === String(req.user._id);
    if (!isSelf && !(await canManageUser(req.user, userId))) throw new HttpError(403, 'Not allowed');
    const bal = await LeaveBalance.findOne({ user: userId, leaveType: leaveTypeId, year: yearOf(req.query.year) })
      .populate('history.by', 'name')
      .populate('leaveType', 'name');
    res.json(bal || null);
  })
);

// Year-start processing: allocate entitlements + carry forward for every active employee
router.post(
  '/initialize',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const year = yearOf(req.body.year);
    const users = await User.find({ isActive: true });
    const before = await LeaveBalance.countDocuments({ year });
    await getBalancesForUsers(users, year);
    const created = (await LeaveBalance.countDocuments({ year })) - before;
    await AuditLog.create({ action: 'balance.initialize', actor: req.user._id, details: { year, created } });
    res.json({ message: `Balances initialised for ${users.length} employees (${created} new records) for ${year}`, created });
  })
);

export default router;
