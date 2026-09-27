import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Department from './models/Department.js';
import LeaveType from './models/LeaveType.js';
import LeaveBalance from './models/LeaveBalance.js';
import LeaveRequest from './models/LeaveRequest.js';
import Settings from './models/Settings.js';
import AuditLog from './models/AuditLog.js';
import { getBalancesForUsers, countLeaveDays } from './utils/leave.js';
import { todayUTC, addDays } from './utils/dates.js';

const PASSWORD = 'password123';
const reset = process.argv.includes('--reset');

async function run() {
  await connectDB();

  if ((await User.countDocuments()) > 0 && !reset) {
    console.log('Database already has users. Run "npm run seed -- --reset" to wipe and reseed.');
    return;
  }
  if (reset) {
    await Promise.all([User, Department, LeaveType, LeaveBalance, LeaveRequest, Settings, AuditLog].map((M) => M.deleteMany({})));
    console.log('Cleared existing data');
  }

  const y = new Date().getFullYear();
  const d = (m, day, yr = y) => new Date(Date.UTC(yr, m - 1, day));
  const settings = await Settings.create({
    organizationName: 'Acme Technologies',
    workingDays: [1, 2, 3, 4, 5],
    holidays: [
      { date: d(1, 1), name: "New Year's Day" },
      { date: d(1, 26), name: 'Republic Day' },
      { date: d(3, 4), name: 'Holi' },
      { date: d(5, 1), name: 'Labour Day' },
      { date: d(8, 15), name: 'Independence Day' },
      { date: d(10, 2), name: 'Gandhi Jayanti' },
      { date: d(11, 9), name: 'Diwali' },
      { date: d(12, 25), name: 'Christmas' },
      { date: d(1, 1, y + 1), name: "New Year's Day" },
      { date: d(1, 26, y + 1), name: 'Republic Day' },
    ],
    allowNegativeBalance: false,
    secondLevelApprovalThreshold: 5,
    maxBackdatedDays: 7,
  });

  const types = await LeaveType.insertMany([
    { name: 'Casual Leave', code: 'CL', color: '#2a78d6', defaultDays: 12, allowHalfDay: true, minNoticeDays: 1, maxConsecutiveDays: 3, description: 'Short personal leave for errands or emergencies' },
    { name: 'Medical Leave', code: 'ML', color: '#eb6834', defaultDays: 10, allowHalfDay: true, requiresDocument: true, docRequiredAfterDays: 2, description: 'Sick leave; medical certificate needed beyond 2 days' },
    { name: 'Earned Leave', code: 'EL', color: '#1baf7a', defaultDays: 18, roleEntitlements: { team_manager: 21, general_manager: 24 }, carryForward: true, maxCarryForward: 10, allowHalfDay: false, minNoticeDays: 7, description: 'Planned vacation; up to 10 days carry forward' },
    { name: 'Maternity Leave', code: 'MAT', color: '#e87ba4', defaultDays: 182, gender: 'female', allowHalfDay: false, requiresDocument: true, docRequiredAfterDays: 0, minNoticeDays: 30, description: '26 weeks paid maternity leave' },
    { name: 'Paternity Leave', code: 'PAT', color: '#4a3aa7', defaultDays: 10, gender: 'male', allowHalfDay: false, minNoticeDays: 7, description: 'Paid leave for new fathers' },
    { name: 'Compensatory Off', code: 'CO', color: '#008300', defaultDays: 0, allowHalfDay: true, description: 'Credited by managers for extra days worked' },
    { name: 'Loss of Pay', code: 'LOP', color: '#eda100', defaultDays: 0, isPaid: false, allowHalfDay: true, description: 'Unpaid leave when other balances are exhausted' },
  ]);
  const T = Object.fromEntries(types.map((t) => [t.code, t]));

  const [eng, sales, hr] = await Department.insertMany([
    { name: 'Engineering', code: 'ENG', description: 'Product engineering' },
    { name: 'Sales', code: 'SAL', description: 'Sales & business development' },
    { name: 'Human Resources', code: 'HR', description: 'People operations' },
  ]);

  const mk = (data) => User.create({ password: PASSWORD, joinDate: d(1, 10, y - 2), ...data });
  const admin = await mk({ name: 'System Admin', email: 'admin@company.com', employeeId: 'EMP001', role: 'admin', department: hr._id, designation: 'HR Administrator', gender: 'female' });
  const gm = await mk({ name: 'Grace Mathew', email: 'gm@company.com', employeeId: 'EMP002', role: 'general_manager', department: hr._id, designation: 'General Manager', gender: 'female' });
  const mgr = await mk({ name: 'Mohan Kumar', email: 'manager@company.com', employeeId: 'EMP003', role: 'team_manager', department: eng._id, reportsTo: gm._id, designation: 'Engineering Manager', gender: 'male' });
  const smgr = await mk({ name: 'Sara Iyer', email: 'sales.manager@company.com', employeeId: 'EMP004', role: 'team_manager', department: sales._id, reportsTo: gm._id, designation: 'Sales Manager', gender: 'female' });
  const lead = await mk({ name: 'Lakshmi Nair', email: 'leader@company.com', employeeId: 'EMP005', role: 'team_leader', department: eng._id, reportsTo: mgr._id, designation: 'Tech Lead', gender: 'female' });
  const lead2 = await mk({ name: 'Arjun Das', email: 'leader2@company.com', employeeId: 'EMP006', role: 'team_leader', department: sales._id, reportsTo: smgr._id, designation: 'Sales Team Lead', gender: 'male' });
  const m1 = await mk({ name: 'Ravi Shankar', email: 'member@company.com', employeeId: 'EMP007', role: 'team_member', department: eng._id, reportsTo: lead._id, designation: 'Software Engineer', gender: 'male' });
  const m2 = await mk({ name: 'Priya Menon', email: 'priya@company.com', employeeId: 'EMP008', role: 'team_member', department: eng._id, reportsTo: lead._id, designation: 'QA Engineer', gender: 'female' });
  const m3 = await mk({ name: 'Kiran Rao', email: 'kiran@company.com', employeeId: 'EMP009', role: 'team_member', department: sales._id, reportsTo: lead2._id, designation: 'Sales Executive', gender: 'male' });
  const m4 = await mk({ name: 'Anita Joseph', email: 'anita@company.com', employeeId: 'EMP010', role: 'team_member', department: sales._id, reportsTo: lead2._id, designation: 'Account Executive', gender: 'female' });
  await Department.updateOne({ _id: eng._id }, { head: mgr._id });
  await Department.updateOne({ _id: sales._id }, { head: smgr._id });
  await Department.updateOne({ _id: hr._id }, { head: gm._id });

  const everyone = [admin, gm, mgr, smgr, lead, lead2, m1, m2, m3, m4];
  await getBalancesForUsers(everyone, y);

  // Sample requests relative to today
  const today = todayUTC();
  const nextWeekday = (from) => {
    let x = from;
    while (!settings.workingDays.includes(x.getUTCDay())) x = addDays(x, 1);
    return x;
  };
  const sample = async ({ emp, type, start, len = 1, status, approver, reason }) => {
    const s = nextWeekday(start);
    const e = addDays(s, len - 1);
    if (s.getUTCFullYear() !== y || e.getUTCFullYear() !== y) return;
    const days = countLeaveDays(s, e, settings);
    if (!days) return;
    const approved = status === 'approved';
    await LeaveRequest.create({
      employee: emp._id, leaveType: type._id, startDate: s, endDate: e, days, year: y, reason, status, appliedBy: emp._id,
      approvals: [{ level: 1, approver: approver._id, status: approved ? 'approved' : status === 'rejected' ? 'rejected' : 'pending', actedBy: approved || status === 'rejected' ? approver._id : null, actedAt: approved || status === 'rejected' ? new Date() : null, comment: approved ? 'Approved' : status === 'rejected' ? 'Critical release that week' : '' }],
    });
    const inc = approved ? { used: days } : status === 'pending' ? { pending: days } : {};
    await LeaveBalance.updateOne({ user: emp._id, leaveType: type._id, year: y }, { $inc: inc });
  };

  await sample({ emp: m1, type: T.CL, start: addDays(today, -20), len: 2, status: 'approved', approver: lead, reason: 'Family function' });
  await sample({ emp: m1, type: T.ML, start: addDays(today, -40), len: 1, status: 'approved', approver: lead, reason: 'Fever' });
  await sample({ emp: m1, type: T.CL, start: addDays(today, 3), len: 1, status: 'pending', approver: lead, reason: 'Bank work' });
  await sample({ emp: m2, type: T.EL, start: addDays(today, 10), len: 3, status: 'pending', approver: lead, reason: 'Vacation with family' });
  await sample({ emp: m2, type: T.CL, start: today, len: 1, status: 'approved', approver: lead, reason: 'Personal errand' });
  await sample({ emp: lead, type: T.CL, start: addDays(today, 5), len: 2, status: 'pending', approver: mgr, reason: 'Travel to hometown' });
  await sample({ emp: m3, type: T.CL, start: addDays(today, -10), len: 1, status: 'rejected', approver: lead2, reason: 'Personal work' });
  await sample({ emp: m3, type: T.EL, start: addDays(today, 8), len: 2, status: 'approved', approver: lead2, reason: 'Short trip' });
  await sample({ emp: m4, type: T.ML, start: addDays(today, -3), len: 2, status: 'approved', approver: lead2, reason: 'Viral infection' });
  await sample({ emp: m4, type: T.CL, start: addDays(today, 2), len: 1, status: 'pending', approver: lead2, reason: 'Parent-teacher meeting' });

  console.log('\nSeed complete. All accounts use password:', PASSWORD);
  console.table(everyone.map((u) => ({ email: u.email, role: u.role })));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
