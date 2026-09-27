import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { APPROVER_ROLES, OVERRIDE_ROLES, isAdmin, canOverride } from '../utils/roles.js';
import { validateLeave, buildApprovalChain, canManageUser, teamUserFilter, releasePending } from '../utils/leave.js';
import { toUTCDate } from '../utils/dates.js';

const router = Router();
router.use(protect);

export const populateLeave = (q) =>
  q
    .populate({ path: 'employee', select: 'name email employeeId role department reportsTo', populate: { path: 'department', select: 'name code' } })
    .populate('leaveType', 'name code color isPaid')
    .populate('approvals.approver', 'name role')
    .populate('approvals.actedBy', 'name role')
    .populate('appliedBy', 'name role');

const idOf = (v) => String(v?._id || v);

function currentStep(leave) {
  return leave.approvals.find((a) => a.level === leave.currentLevel);
}

/** Can this user act (approve/reject) on the current step? */
function canAct(user, leave) {
  if (leave.status !== 'pending') return false;
  if (idOf(leave.employee) === String(user._id)) return false;
  const step = currentStep(leave);
  if (!step) return false;
  if (step.approver && idOf(step.approver) === String(user._id)) return true;
  return isAdmin(user); // admin/GM can act on the pool or override the assigned approver
}

// ---------- Employee endpoints ----------

router.post(
  '/preview',
  ah(async (req, res) => {
    const settings = await Settings.get();
    const v = await validateLeave({ employee: req.user, ...req.body, settings });
    let chain = [];
    if (!v.errors.length) {
      chain = await buildApprovalChain(req.user, v.days, settings);
      const approvers = await User.find({ _id: { $in: chain.map((c) => c.approver).filter(Boolean) } }).select('name role');
      chain = chain.map((c) => ({ level: c.level, approver: approvers.find((a) => idOf(a) === idOf(c.approver)) || null }));
    }
    res.json({
      days: v.days,
      errors: v.errors,
      warnings: v.warnings,
      available: v.balance ? v.balance.available : null,
      approvalChain: chain,
    });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const settings = await Settings.get();
    const { leaveTypeId, startDate, endDate, halfDay, halfDaySession, reason, documentRef, contactDuringLeave } = req.body;
    if (!String(reason || '').trim()) throw new HttpError(400, 'Please provide a reason for the leave');
    const v = await validateLeave({ employee: req.user, leaveTypeId, startDate, endDate, halfDay, halfDaySession, documentRef, settings });
    if (v.errors.length) throw new HttpError(400, v.errors[0], v.errors);

    const approvals = await buildApprovalChain(req.user, v.days, settings);
    const leave = await LeaveRequest.create({
      employee: req.user._id,
      leaveType: v.leaveType._id,
      startDate: v.start,
      endDate: v.end,
      halfDay: !!halfDay,
      halfDaySession: halfDay ? halfDaySession : null,
      days: v.days,
      year: v.year,
      reason,
      documentRef,
      contactDuringLeave,
      approvals,
      appliedBy: req.user._id,
    });
    await LeaveBalance.updateOne({ _id: v.balance._id }, { $inc: { pending: v.days } });
    res.status(201).json(await populateLeave(LeaveRequest.findById(leave._id)));
  })
);

router.get(
  '/my',
  ah(async (req, res) => {
    const filter = { employee: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.leaveType && mongoose.isValidObjectId(req.query.leaveType)) filter.leaveType = req.query.leaveType;
    res.json(await populateLeave(LeaveRequest.find(filter).sort('-startDate')));
  })
);

// ---------- Approver endpoints ----------

router.get(
  '/approvals',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const me = req.user._id;
    let filter;
    if (isAdmin(req.user) && req.query.scope === 'all') {
      filter = { status: 'pending', employee: { $ne: me } };
    } else if (isAdmin(req.user)) {
      filter = {
        status: 'pending',
        employee: { $ne: me },
        $or: [
          { approvals: { $elemMatch: { approver: me, status: 'pending' } } },
          { approvals: { $elemMatch: { approver: null, status: 'pending' } } },
        ],
      };
    } else {
      filter = { status: 'pending', approvals: { $elemMatch: { approver: me, status: 'pending' } } };
    }
    const leaves = await populateLeave(LeaveRequest.find(filter).sort('startDate'));
    if (!leaves.length) return res.json([]);

    // Attach each applicant's current balance for context
    const balances = await LeaveBalance.find({
      $or: leaves.map((l) => ({ user: l.employee._id, leaveType: l.leaveType._id, year: l.year })),
    });
    const result = leaves.map((l) => {
      const b = balances.find((x) => idOf(x.user) === idOf(l.employee) && idOf(x.leaveType) === idOf(l.leaveType) && x.year === l.year);
      return { ...l.toJSON(), balanceAvailable: b ? b.available : null, canAct: canAct(req.user, l) };
    });
    res.json(result);
  })
);

router.get(
  '/team',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const team = await User.find(await teamUserFilter(req.user)).select('_id');
    const filter = { employee: { $in: team.map((u) => u._id) } };
    const { status, from, to, employee, leaveType, year } = req.query;
    if (status) filter.status = status;
    if (year) filter.year = Number(year);
    if (employee && mongoose.isValidObjectId(employee)) filter.employee = employee;
    if (leaveType && mongoose.isValidObjectId(leaveType)) filter.leaveType = leaveType;
    const f = toUTCDate(from);
    const t = toUTCDate(to);
    if (f) filter.endDate = { $gte: f };
    if (t) filter.startDate = { $lte: t };
    if (typeof filter.employee === 'string' && !(await canManageUser(req.user, filter.employee))) {
      throw new HttpError(403, 'This employee is not in your team');
    }
    res.json(await populateLeave(LeaveRequest.find(filter).sort('-startDate').limit(1000)));
  })
);

// Team calendar for a month (YYYY-MM). Members see their own leave plus peers under the same manager.
router.get(
  '/calendar',
  ah(async (req, res) => {
    const [y, m] = String(req.query.month || '').split('-').map(Number);
    const now = new Date();
    const year = y || now.getFullYear();
    const month = m ? m - 1 : now.getMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));

    let userIds;
    if (APPROVER_ROLES.includes(req.user.role)) {
      const filter = await teamUserFilter(req.user);
      userIds = (await User.find({ ...filter, isActive: true }).select('_id')).map((u) => u._id);
      userIds.push(req.user._id);
    } else {
      const peers = req.user.reportsTo ? await User.find({ reportsTo: req.user.reportsTo, isActive: true }).select('_id') : [];
      userIds = [req.user._id, ...peers.map((p) => p._id)];
    }
    if (req.query.department && mongoose.isValidObjectId(req.query.department)) {
      userIds = (await User.find({ _id: { $in: userIds }, department: req.query.department }).select('_id')).map((u) => u._id);
    }

    const statuses = req.query.includePending === 'false' ? ['approved'] : ['approved', 'pending'];
    const leaves = await LeaveRequest.find({
      employee: { $in: userIds },
      status: { $in: statuses },
      startDate: { $lte: end },
      endDate: { $gte: start },
    })
      .populate('employee', 'name employeeId')
      .populate('leaveType', 'name code color')
      .sort('startDate');

    const settings = await Settings.get();
    const holidays = settings.holidays.filter((h) => h.date >= start && h.date <= end);
    res.json({ month: `${year}-${String(month + 1).padStart(2, '0')}`, leaves, holidays, workingDays: settings.workingDays });
  })
);

// Manager records leave on behalf of a team member, bypassing policy checks (admin override).
router.post(
  '/override',
  authorize(...OVERRIDE_ROLES),
  ah(async (req, res) => {
    const { employeeId, leaveTypeId, startDate, endDate, halfDay, halfDaySession, reason, overrideReason } = req.body;
    if (!String(overrideReason || '').trim()) throw new HttpError(400, 'An override justification is required');
    if (!mongoose.isValidObjectId(employeeId)) throw new HttpError(400, 'Select an employee');
    if (!(await canManageUser(req.user, employeeId))) throw new HttpError(403, 'This employee is not in your team');
    const employee = await User.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found');

    const settings = await Settings.get();
    const v = await validateLeave({ employee, leaveTypeId, startDate, endDate, halfDay, halfDaySession, settings, skipPolicy: true });
    if (v.errors.length) throw new HttpError(400, v.errors[0], v.errors);

    const now = new Date();
    const leave = await LeaveRequest.create({
      employee: employee._id,
      leaveType: v.leaveType._id,
      startDate: v.start,
      endDate: v.end,
      halfDay: !!halfDay,
      halfDaySession: halfDay ? halfDaySession : null,
      days: v.days,
      year: v.year,
      reason: reason || overrideReason,
      status: 'approved',
      approvals: [{ level: 1, approver: req.user._id, status: 'approved', comment: `Override: ${overrideReason}`, actedBy: req.user._id, actedAt: now, overridden: true }],
      isOverride: true,
      overrideReason,
      appliedBy: req.user._id,
    });
    await LeaveBalance.updateOne(
      { _id: v.balance._id },
      { $inc: { used: v.days }, $push: { history: { kind: 'override', amount: -v.days, reason: overrideReason, by: req.user._id } } }
    );
    await AuditLog.create({
      action: 'leave.override',
      actor: req.user._id,
      target: employee._id,
      details: { leaveId: leave._id, days: v.days, leaveType: v.leaveType.name, reason: overrideReason, warnings: v.warnings },
    });
    res.status(201).json({ leave: await populateLeave(LeaveRequest.findById(leave._id)), warnings: v.warnings });
  })
);

// ---------- Single request ----------

router.get(
  '/:id',
  ah(async (req, res) => {
    const leave = await populateLeave(LeaveRequest.findById(req.params.id));
    if (!leave) throw new HttpError(404, 'Leave request not found');
    const me = String(req.user._id);
    const allowed =
      idOf(leave.employee) === me ||
      leave.approvals.some((a) => a.approver && idOf(a.approver) === me) ||
      (await canManageUser(req.user, leave.employee._id));
    if (!allowed) throw new HttpError(403, 'Not allowed');
    res.json({ ...leave.toJSON(), canAct: canAct(req.user, leave) });
  })
);

router.put(
  '/:id/approve',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id).populate('leaveType');
    if (!leave) throw new HttpError(404, 'Leave request not found');
    if (!canAct(req.user, leave)) throw new HttpError(403, 'You cannot act on this request at its current stage');
    const { comment = '', override = false } = req.body;
    if (override && !canOverride(req.user)) throw new HttpError(403, 'Only managers can override leave policy');

    const step = currentStep(leave);
    const next = leave.approvals.find((a) => a.level === leave.currentLevel + 1);
    const finalize = !next || isAdmin(req.user);

    if (finalize && leave.leaveType.isPaid) {
      const settings = await Settings.get();
      const bal = await LeaveBalance.findOne({ user: leave.employee, leaveType: leave.leaveType._id, year: leave.year });
      // pending already includes this request, so a negative "available" means the balance was reduced after applying
      if (bal && bal.available < 0 && !settings.allowNegativeBalance && !override) {
        throw new HttpError(400, `Employee's balance is insufficient (${bal.available} after this request). Tick "override policy" to approve anyway.`);
      }
    }

    step.status = 'approved';
    step.comment = comment;
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.overridden = (!!step.approver && idOf(step.approver) !== String(req.user._id)) || !!override;

    if (finalize) {
      leave.status = 'approved';
      leave.approvals.forEach((a) => {
        if (a.status === 'waiting' || a.status === 'pending') a.status = 'skipped';
      });
      if (override) {
        leave.isOverride = true;
        leave.overrideReason = comment || 'Approved with policy override';
      }
      await leave.save();
      await releasePending(leave, { toUsed: true });
    } else {
      next.status = 'pending';
      leave.currentLevel = next.level;
      await leave.save();
    }

    if (step.overridden) {
      await AuditLog.create({ action: 'leave.approve.override', actor: req.user._id, target: leave.employee, details: { leaveId: leave._id, comment } });
    }
    res.json(await populateLeave(LeaveRequest.findById(leave._id)));
  })
);

router.put(
  '/:id/reject',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) throw new HttpError(404, 'Leave request not found');
    if (!canAct(req.user, leave)) throw new HttpError(403, 'You cannot act on this request at its current stage');
    const comment = String(req.body.comment || '').trim();
    if (!comment) throw new HttpError(400, 'Please give a reason for rejecting');

    const step = currentStep(leave);
    step.status = 'rejected';
    step.comment = comment;
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.overridden = !!step.approver && idOf(step.approver) !== String(req.user._id);
    leave.approvals.forEach((a) => {
      if (a.status === 'waiting') a.status = 'skipped';
    });
    leave.status = 'rejected';
    await leave.save();
    await releasePending(leave);
    res.json(await populateLeave(LeaveRequest.findById(leave._id)));
  })
);

router.put(
  '/:id/cancel',
  ah(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) throw new HttpError(404, 'Leave request not found');
    if (idOf(leave.employee) !== String(req.user._id)) throw new HttpError(403, 'You can only cancel your own requests');
    if (leave.status !== 'pending') throw new HttpError(400, 'Only pending requests can be cancelled');
    leave.status = 'cancelled';
    leave.cancelledAt = new Date();
    leave.cancelReason = req.body.reason || '';
    leave.approvals.forEach((a) => {
      if (a.status === 'waiting' || a.status === 'pending') a.status = 'skipped';
    });
    await leave.save();
    await releasePending(leave);
    res.json(await populateLeave(LeaveRequest.findById(leave._id)));
  })
);

export default router;
