import { Router } from 'express';
import User from '../models/User.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Settings from '../models/Settings.js';
import { protect } from '../middleware/auth.js';
import { ah } from '../middleware/error.js';
import { isApprover, isAdmin } from '../utils/roles.js';
import { getBalances, teamUserFilter } from '../utils/leave.js';
import { todayUTC, addDays } from '../utils/dates.js';

const router = Router();
router.use(protect);

router.get(
  '/',
  ah(async (req, res) => {
    const year = new Date().getFullYear();
    const today = todayUTC();
    const me = req.user._id;

    const [balances, myLeaves, settings] = await Promise.all([
      getBalances(req.user, year),
      LeaveRequest.find({ employee: me, year }).populate('leaveType', 'name code color').sort('-createdAt'),
      Settings.get(),
    ]);

    const stats = {
      pending: myLeaves.filter((l) => l.status === 'pending').length,
      approved: myLeaves.filter((l) => l.status === 'approved').length,
      rejected: myLeaves.filter((l) => l.status === 'rejected').length,
      daysTaken: myLeaves.filter((l) => l.status === 'approved' && l.startDate <= today).reduce((s, l) => s + l.days, 0),
    };
    const upcoming = myLeaves
      .filter((l) => ['approved', 'pending'].includes(l.status) && l.endDate >= today)
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 5);
    const holidays = settings.holidays.filter((h) => h.date >= today).slice(0, 6);

    const payload = { year, balances, stats, upcoming, recent: myLeaves.slice(0, 5), holidays };

    if (isApprover(req.user)) {
      const filter = await teamUserFilter(req.user);
      const team = await User.find({ ...filter, isActive: true, _id: filter._id || { $ne: me } }).select('_id');
      const teamIds = team.map((u) => u._id);
      const pendingFilter = isAdmin(req.user)
        ? { status: 'pending', employee: { $ne: me }, $or: [{ approvals: { $elemMatch: { approver: me, status: 'pending' } } }, { approvals: { $elemMatch: { approver: null, status: 'pending' } } }] }
        : { status: 'pending', approvals: { $elemMatch: { approver: me, status: 'pending' } } };
      const [pendingApprovals, onLeaveToday, upcomingTeam] = await Promise.all([
        LeaveRequest.countDocuments(pendingFilter),
        LeaveRequest.find({ employee: { $in: teamIds }, status: 'approved', startDate: { $lte: today }, endDate: { $gte: today } })
          .populate('employee', 'name')
          .populate('leaveType', 'name color'),
        LeaveRequest.find({ employee: { $in: teamIds }, status: 'approved', startDate: { $gt: today, $lte: addDays(today, 14) } })
          .populate('employee', 'name')
          .populate('leaveType', 'name color')
          .sort('startDate')
          .limit(8),
      ]);
      payload.team = { size: teamIds.length, pendingApprovals, onLeaveToday, upcoming: upcomingTeam };
    }
    res.json(payload);
  })
);

export default router;
