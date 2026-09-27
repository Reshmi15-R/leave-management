import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import LeaveType from '../models/LeaveType.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Department from '../models/Department.js';
import Settings from '../models/Settings.js';
import { protect, authorize } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { APPROVER_ROLES, ADMIN_ROLES, ROLE_LABELS } from '../utils/roles.js';
import { getBalances, getBalancesForUsers, canManageUser, teamUserFilter } from '../utils/leave.js';
import { fmtDate } from '../utils/dates.js';
import { sendCSV, sendPDF } from '../utils/export.js';

const router = Router();
router.use(protect);

const yearOf = (q) => Number(q) || new Date().getFullYear();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- Employee leave statement ----------
router.get(
  '/statement',
  ah(async (req, res) => {
    const year = yearOf(req.query.year);
    const format = req.query.format || 'pdf';
    const userId = req.query.userId || String(req.user._id);
    if (userId !== String(req.user._id) && !(await canManageUser(req.user, userId))) throw new HttpError(403, 'Not allowed');

    const user = await User.findById(userId).populate('department', 'name').populate('reportsTo', 'name');
    if (!user) throw new HttpError(404, 'User not found');
    const [balances, leaves, settings] = await Promise.all([
      getBalances(user, year),
      LeaveRequest.find({ employee: user._id, year }).populate('leaveType', 'name code').sort('startDate'),
      Settings.get(),
    ]);

    const balHeaders = ['Leave Type', 'Entitled', 'Carried Fwd', 'Adjusted', 'Used', 'Pending', 'Available'];
    const balRows = balances.map((b) => [b.leaveType.name, b.allocated, b.carriedForward, b.adjusted, b.used, b.pending, b.available]);
    const histHeaders = ['Applied On', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Reason'];
    const histRows = leaves.map((l) => [
      fmtDate(l.createdAt), l.leaveType?.name, fmtDate(l.startDate), fmtDate(l.endDate),
      l.halfDay ? `0.5 (${l.halfDaySession} half)` : l.days, cap(l.status) + (l.isOverride ? ' (override)' : ''), l.reason,
    ]);
    const fname = `leave-statement-${user.employeeId}-${year}`;

    if (format === 'json') return res.json({ user, year, balances, leaves });
    if (format === 'csv') {
      return sendCSV(res, `${fname}.csv`, [
        { title: `Leave statement ${year} - ${user.name} (${user.employeeId})`, headers: balHeaders, rows: balRows },
        { title: 'Leave history', headers: histHeaders, rows: histRows },
      ]);
    }
    sendPDF(res, `${fname}.pdf`, {
      title: 'Leave Statement',
      subtitle: `${settings.organizationName} · Year ${year}`,
      meta: [
        ['Employee', `${user.name} (${user.employeeId})`],
        ['Role', ROLE_LABELS[user.role]],
        ['Department', user.department?.name || '-'],
        ['Reports to', user.reportsTo?.name || '-'],
        ['Email', user.email],
      ],
      sections: [
        { title: 'Leave Balances', headers: balHeaders, rows: balRows, widths: [115, 65, 65, 65, 65, 65, 75] },
        { title: 'Leave History', headers: histHeaders, rows: histRows, widths: [65, 75, 65, 65, 55, 70, 120] },
      ],
    });
  })
);

// ---------- Team report ----------
router.get(
  '/team',
  authorize(...APPROVER_ROLES),
  ah(async (req, res) => {
    const year = yearOf(req.query.year);
    const format = req.query.format || 'json';
    const filter = { ...(await teamUserFilter(req.user)) };
    if (!filter._id) filter._id = { $ne: req.user._id };
    const [team, types, settings] = await Promise.all([
      User.find(filter).populate('department', 'name').sort('name'),
      LeaveType.find({ isActive: true }).sort('name'),
      Settings.get(),
    ]);
    const leaves = await LeaveRequest.find({ employee: { $in: team.map((u) => u._id) }, year })
      .populate('employee', 'name employeeId')
      .populate('leaveType', 'name code')
      .sort('startDate');

    const balancesByUser = await getBalancesForUsers(team, year);
    const rows = [];
    for (const u of team) {
      const mine = leaves.filter((l) => String(l.employee._id) === String(u._id));
      const approved = mine.filter((l) => l.status === 'approved');
      const balances = balancesByUser.get(String(u._id));
      const byType = {};
      for (const t of types) byType[t.code] = approved.filter((l) => String(l.leaveType._id) === String(t._id)).reduce((s, l) => s + l.days, 0);
      rows.push({
        user: { _id: u._id, name: u.name, employeeId: u.employeeId, department: u.department?.name || '-', isActive: u.isActive },
        byType,
        totalUsed: approved.reduce((s, l) => s + l.days, 0),
        totalAvailable: balances.filter((b) => b.leaveType.isPaid).reduce((s, b) => s + b.available, 0),
        pendingRequests: mine.filter((l) => l.status === 'pending').length,
        rejectedRequests: mine.filter((l) => l.status === 'rejected').length,
      });
    }
    const summary = {
      members: team.length,
      totalRequests: leaves.length,
      approvedDays: rows.reduce((s, r) => s + r.totalUsed, 0),
      pending: leaves.filter((l) => l.status === 'pending').length,
      byType: types.map((t) => ({ name: t.name, code: t.code, color: t.color, days: rows.reduce((s, r) => s + (r.byType[t.code] || 0), 0) })),
    };

    const headers = ['Employee', 'Emp ID', 'Department', ...types.map((t) => t.code), 'Total Used', 'Available', 'Pending'];
    const tableRows = rows.map((r) => [r.user.name, r.user.employeeId, r.user.department, ...types.map((t) => r.byType[t.code]), r.totalUsed, r.totalAvailable, r.pendingRequests]);
    const detailHeaders = ['Employee', 'Leave Type', 'From', 'To', 'Days', 'Status'];
    const detailRows = leaves.map((l) => [l.employee.name, l.leaveType.name, fmtDate(l.startDate), fmtDate(l.endDate), l.days, cap(l.status)]);

    if (format === 'csv') {
      return sendCSV(res, `team-leave-report-${year}.csv`, [
        { title: `Team leave summary ${year}`, headers, rows: tableRows },
        { title: 'Leave requests', headers: detailHeaders, rows: detailRows },
      ]);
    }
    if (format === 'pdf') {
      return sendPDF(res, `team-leave-report-${year}.pdf`, {
        title: 'Team Leave Report',
        subtitle: `${settings.organizationName} · Year ${year} · Prepared for ${req.user.name}`,
        landscape: true,
        meta: [['Team members', summary.members], ['Requests', summary.totalRequests], ['Approved days', summary.approvedDays], ['Pending requests', summary.pending]],
        sections: [
          { title: 'Summary by Employee', headers, rows: tableRows },
          { title: 'Leave Requests', headers: detailHeaders, rows: detailRows },
        ],
      });
    }
    res.json({ year, types, rows, summary, leaves });
  })
);

// ---------- Organisation report ----------
router.get(
  '/organization',
  authorize(...ADMIN_ROLES),
  ah(async (req, res) => {
    const year = yearOf(req.query.year);
    const format = req.query.format || 'json';
    const userFilter = {};
    if (req.query.department && mongoose.isValidObjectId(req.query.department)) userFilter.department = req.query.department;

    const [users, departments, types, settings] = await Promise.all([
      User.find(userFilter).populate('department', 'name'),
      Department.find().sort('name'),
      LeaveType.find().sort('name'),
      Settings.get(),
    ]);
    const leaves = await LeaveRequest.find({ year, employee: { $in: users.map((u) => u._id) } }).populate('leaveType', 'name');
    const approved = leaves.filter((l) => l.status === 'approved');
    const userById = Object.fromEntries(users.map((u) => [String(u._id), u]));
    const activeUsers = users.filter((u) => u.isActive);

    const byStatus = ['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ status: s, count: leaves.filter((l) => l.status === s).length }));

    const deptKey = (u) => (u?.department ? String(u.department._id) : 'none');
    const deptList = [...departments.map((d) => ({ id: String(d._id), name: d.name })), { id: 'none', name: 'Unassigned' }];
    const byDepartment = deptList
      .map((d) => {
        const emps = activeUsers.filter((u) => deptKey(u) === d.id);
        const dl = approved.filter((l) => deptKey(userById[String(l.employee)]) === d.id);
        const days = dl.reduce((s, l) => s + l.days, 0);
        return { department: d.name, employees: emps.length, requests: leaves.filter((l) => deptKey(userById[String(l.employee)]) === d.id).length, approvedDays: days, avgPerEmployee: emps.length ? Math.round((days / emps.length) * 10) / 10 : 0 };
      })
      .filter((d) => d.employees || d.requests);

    const byType = types
      .map((t) => {
        const tl = leaves.filter((l) => String(l.leaveType._id) === String(t._id));
        return { name: t.name, code: t.code, color: t.color, requests: tl.length, approvedDays: tl.filter((l) => l.status === 'approved').reduce((s, l) => s + l.days, 0) };
      })
      .filter((t) => t.requests || types.find((x) => x.code === t.code).isActive);

    const byMonth = MONTHS.map((m, i) => ({
      month: m,
      days: approved.filter((l) => l.startDate.getUTCMonth() === i).reduce((s, l) => s + l.days, 0),
      requests: leaves.filter((l) => l.startDate.getUTCMonth() === i).length,
    }));

    const totals = {};
    approved.forEach((l) => (totals[String(l.employee)] = (totals[String(l.employee)] || 0) + l.days));
    const topTakers = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, days]) => ({ name: userById[id]?.name, employeeId: userById[id]?.employeeId, department: userById[id]?.department?.name || '-', days }));

    const approvedDays = approved.reduce((s, l) => s + l.days, 0);
    const summary = {
      employees: activeUsers.length,
      departments: departments.filter((d) => d.isActive).length,
      totalRequests: leaves.length,
      approvedDays,
      avgDaysPerEmployee: activeUsers.length ? Math.round((approvedDays / activeUsers.length) * 10) / 10 : 0,
      approvalRate: leaves.filter((l) => ['approved', 'rejected'].includes(l.status)).length
        ? Math.round((approved.length / leaves.filter((l) => ['approved', 'rejected'].includes(l.status)).length) * 100)
        : 0,
      overrides: leaves.filter((l) => l.isOverride).length,
    };

    const sections = [
      { title: 'By Department', headers: ['Department', 'Employees', 'Requests', 'Approved Days', 'Avg Days / Employee'], rows: byDepartment.map((d) => [d.department, d.employees, d.requests, d.approvedDays, d.avgPerEmployee]) },
      { title: 'By Leave Type', headers: ['Leave Type', 'Code', 'Requests', 'Approved Days'], rows: byType.map((t) => [t.name, t.code, t.requests, t.approvedDays]) },
      { title: 'By Month (leave start)', headers: ['Month', 'Requests', 'Approved Days'], rows: byMonth.map((m) => [m.month, m.requests, m.days]) },
      { title: 'By Status', headers: ['Status', 'Requests'], rows: byStatus.map((s) => [cap(s.status), s.count]) },
      { title: 'Top Leave Takers', headers: ['Employee', 'Emp ID', 'Department', 'Approved Days'], rows: topTakers.map((t) => [t.name, t.employeeId, t.department, t.days]) },
    ];

    if (format === 'csv') return sendCSV(res, `organization-leave-report-${year}.csv`, sections);
    if (format === 'pdf') {
      return sendPDF(res, `organization-leave-report-${year}.pdf`, {
        title: 'Organization Leave Report',
        subtitle: `${settings.organizationName} · Year ${year}`,
        meta: [
          ['Active employees', summary.employees],
          ['Leave requests', summary.totalRequests],
          ['Approved leave days', summary.approvedDays],
          ['Average days per employee', summary.avgDaysPerEmployee],
          ['Approval rate', `${summary.approvalRate}%`],
          ['Policy overrides', summary.overrides],
        ],
        sections,
      });
    }
    res.json({ year, summary, byDepartment, byType, byMonth, byStatus, topTakers });
  })
);

export default router;
