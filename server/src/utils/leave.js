import mongoose from 'mongoose';
import User from '../models/User.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { isAdmin } from './roles.js';
import { toUTCDate, todayUTC, isoDay, eachDay, diffDays } from './dates.js';

const round = (n) => Math.round(n * 100) / 100;

/** Working days between two dates (inclusive), skipping weekends and holidays. */
export function countLeaveDays(start, end, settings, halfDay = false) {
  const holidays = new Set((settings.holidays || []).map((h) => isoDay(h.date)));
  const working = new Set(settings.workingDays?.length ? settings.workingDays : [1, 2, 3, 4, 5]);
  let count = 0;
  eachDay(start, end, (d) => {
    if (working.has(d.getUTCDay()) && !holidays.has(isoDay(d))) count += 1;
  });
  if (halfDay) return count > 0 ? 0.5 : 0;
  return count;
}

export function getEntitlement(leaveType, role) {
  const v = leaveType.roleEntitlements?.[role];
  return v === null || v === undefined ? leaveType.defaultDays : v;
}

const appliesTo = (type, user) => type.gender === 'all' || !user.gender || type.gender === user.gender;
const isDuplicateError = (err) => err.code === 11000 || (err.writeErrors?.length && err.writeErrors.every((e) => (e.code ?? e.err?.code) === 11000));

/** New balance document: role entitlement plus capped carry-forward from the previous year's balance. */
function newBalanceDoc(user, leaveType, year, prev) {
  const allocated = getEntitlement(leaveType, user.role);
  const carriedForward =
    prev && leaveType.carryForward && leaveType.maxCarryForward > 0 ? Math.max(0, Math.min(prev.available, leaveType.maxCarryForward)) : 0;
  const history = [{ kind: 'allocation', amount: allocated, reason: `Annual entitlement ${year}` }];
  if (carriedForward) history.push({ kind: 'carry_forward', amount: carriedForward, reason: `Carried forward from ${year - 1}` });
  return { user: user._id, leaveType: leaveType._id, year, allocated, carriedForward, history };
}

/** Returns the balance document for (user, type, year), creating it if missing. */
export async function ensureBalance(user, leaveType, year) {
  const existing = await LeaveBalance.findOne({ user: user._id, leaveType: leaveType._id, year });
  if (existing) return existing;
  const prev = leaveType.carryForward ? await LeaveBalance.findOne({ user: user._id, leaveType: leaveType._id, year: year - 1 }) : null;
  try {
    return await LeaveBalance.create(newBalanceDoc(user, leaveType, year, prev));
  } catch (err) {
    if (err.code === 11000) return LeaveBalance.findOne({ user: user._id, leaveType: leaveType._id, year });
    throw err;
  }
}

/**
 * Balances for many users at once (Map userId -> balances[]), creating missing ones in bulk.
 * Uses a fixed number of queries regardless of team size.
 */
export async function getBalancesForUsers(users, year) {
  const types = await LeaveType.find({ isActive: true }).sort('name');
  const userIds = users.map((u) => u._id);
  const key = (u, t) => `${u}_${t}`;

  let existing = await LeaveBalance.find({ user: { $in: userIds }, year });
  const have = new Set(existing.map((b) => key(b.user, b.leaveType)));
  const missing = [];
  for (const u of users) for (const t of types) if (appliesTo(t, u) && !have.has(key(u._id, t._id))) missing.push({ u, t });

  if (missing.length) {
    const needPrev = missing.filter(({ t }) => t.carryForward && t.maxCarryForward > 0);
    const prev = needPrev.length
      ? await LeaveBalance.find({ user: { $in: needPrev.map(({ u }) => u._id) }, leaveType: { $in: needPrev.map(({ t }) => t._id) }, year: year - 1 })
      : [];
    const prevByKey = new Map(prev.map((b) => [key(b.user, b.leaveType), b]));
    try {
      await LeaveBalance.insertMany(
        missing.map(({ u, t }) => newBalanceDoc(u, t, year, prevByKey.get(key(u._id, t._id)))),
        { ordered: false }
      );
    } catch (err) {
      if (!isDuplicateError(err)) throw err; // a concurrent request created some of them first
    }
    existing = await LeaveBalance.find({ user: { $in: userIds }, year });
  }

  const typeById = new Map(types.map((t) => [String(t._id), t]));
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const out = new Map(users.map((u) => [String(u._id), []]));
  for (const b of existing) {
    const t = typeById.get(String(b.leaveType));
    const u = userById.get(String(b.user));
    if (!t || !appliesTo(t, u)) continue;
    const obj = b.toJSON();
    obj.leaveType = t.toJSON();
    out.get(String(b.user)).push(obj);
  }
  for (const list of out.values()) list.sort((a, b) => a.leaveType.name.localeCompare(b.leaveType.name));
  return out;
}

/** Balances for all active leave types applicable to the user. */
export async function getBalances(user, year) {
  return (await getBalancesForUsers([user], year)).get(String(user._id));
}

/** All direct and indirect reports of a user (via reportsTo). */
export async function getSubordinateIds(userId) {
  const result = [];
  const seen = new Set([String(userId)]);
  let frontier = [userId];
  while (frontier.length) {
    const users = await User.find({ reportsTo: { $in: frontier } }).select('_id');
    frontier = [];
    for (const u of users) {
      const id = String(u._id);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(u._id);
        frontier.push(u._id);
      }
    }
  }
  return result;
}

/** Mongo filter on user _id describing whom `actor` may manage. Admin/GM: everyone. */
export async function teamUserFilter(actor) {
  if (isAdmin(actor)) return {};
  const ids = await getSubordinateIds(actor._id);
  return { _id: { $in: ids } };
}

export async function canManageUser(actor, targetId) {
  if (String(actor._id) === String(targetId)) return false;
  if (isAdmin(actor)) return true;
  const ids = await getSubordinateIds(actor._id);
  return ids.some((id) => String(id) === String(targetId));
}

/** Approval chain: direct manager, then their manager when the request exceeds the threshold. */
export async function buildApprovalChain(employee, days, settings) {
  const emp = await User.findById(employee._id).populate('reportsTo');
  const l1 = emp.reportsTo && emp.reportsTo.isActive ? emp.reportsTo : null;
  const chain = [{ level: 1, approver: l1 ? l1._id : null, status: 'pending' }];
  const threshold = settings.secondLevelApprovalThreshold;
  if (l1 && threshold > 0 && days > threshold && l1.reportsTo) {
    chain.push({ level: 2, approver: l1.reportsTo, status: 'waiting' });
  }
  return chain;
}

/**
 * Validates a leave application against organisation policy.
 * With skipPolicy (manager override) only structural checks and overlaps are enforced.
 */
export async function validateLeave({ employee, leaveTypeId, startDate, endDate, halfDay, halfDaySession, documentRef, settings, skipPolicy = false }) {
  const errors = [];
  const warnings = [];

  const leaveType = mongoose.isValidObjectId(leaveTypeId) ? await LeaveType.findById(leaveTypeId) : null;
  if (!leaveType || !leaveType.isActive) errors.push('Please select a valid leave type');

  const start = toUTCDate(startDate);
  const end = toUTCDate(endDate || startDate);
  if (!start || !end) errors.push('Please provide valid start and end dates');
  if (errors.length) return { errors, warnings, days: 0 };

  if (end < start) errors.push('End date cannot be before start date');
  if (start.getUTCFullYear() !== end.getUTCFullYear()) errors.push('A leave request cannot span two calendar years — please split it into two requests');

  if (halfDay) {
    if (!leaveType.allowHalfDay) errors.push(`${leaveType.name} cannot be taken as a half day`);
    if (start.getTime() !== end.getTime()) errors.push('Half-day leave must start and end on the same date');
    if (!['first', 'second'].includes(halfDaySession)) errors.push('Choose the half-day session (first or second half)');
  }
  if (leaveType.gender !== 'all' && employee.gender && employee.gender !== leaveType.gender) {
    errors.push(`${leaveType.name} is not applicable to this employee`);
  }
  if (errors.length) return { errors, warnings, days: 0, leaveType };

  const days = countLeaveDays(start, end, settings, halfDay);
  const year = start.getUTCFullYear();
  if (days === 0) errors.push('The selected dates fall entirely on weekends or holidays');

  if (!skipPolicy) {
    const today = todayUTC();
    const ahead = diffDays(start, today);
    if (ahead < 0 && -ahead > settings.maxBackdatedDays) {
      errors.push(`Leave cannot be backdated more than ${settings.maxBackdatedDays} day(s)`);
    }
    if (ahead > settings.maxFutureDays) errors.push(`Leave cannot be applied more than ${settings.maxFutureDays} days in advance`);
    if (leaveType.minNoticeDays > 0 && ahead < leaveType.minNoticeDays) {
      errors.push(`${leaveType.name} requires at least ${leaveType.minNoticeDays} day(s) advance notice`);
    }
    if (leaveType.maxConsecutiveDays > 0 && days > leaveType.maxConsecutiveDays) {
      errors.push(`${leaveType.name} cannot exceed ${leaveType.maxConsecutiveDays} consecutive working day(s)`);
    }
    if (leaveType.requiresDocument && days > leaveType.docRequiredAfterDays && !String(documentRef || '').trim()) {
      errors.push(`A supporting document is required for ${leaveType.name} longer than ${leaveType.docRequiredAfterDays} day(s)`);
    }
  }

  // Overlap with the employee's own pending/approved leave
  const overlaps = await LeaveRequest.find({
    employee: employee._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  const conflicting = overlaps.filter(
    (o) => !(halfDay && o.halfDay && o.halfDaySession && o.halfDaySession !== halfDaySession)
  );
  if (conflicting.length) errors.push('You already have a pending or approved leave overlapping these dates');

  const balance = await ensureBalance(employee, leaveType, year);
  const available = balance.available;
  if (leaveType.isPaid && days > available) {
    const msg = `Insufficient ${leaveType.name} balance: ${available} day(s) available, ${days} requested`;
    if (skipPolicy || settings.allowNegativeBalance) warnings.push(msg + ' — balance will go negative');
    else errors.push(msg);
  } else if (leaveType.isPaid && available - days < 1 && days > 0) {
    warnings.push(`This will leave you with ${round(available - days)} day(s) of ${leaveType.name}`);
  }

  // Heads-up about teammates already away
  if (employee.reportsTo) {
    const peers = await User.find({ reportsTo: employee.reportsTo, _id: { $ne: employee._id } }).select('_id');
    const away = await LeaveRequest.countDocuments({
      employee: { $in: peers.map((p) => p._id) },
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (away) warnings.push(`${away} teammate leave(s) already approved during this period`);
  }

  return { errors, warnings, days, year, start, end, leaveType, balance };
}

export async function releasePending(leave, { toUsed = false } = {}) {
  const inc = toUsed ? { pending: -leave.days, used: leave.days } : { pending: -leave.days };
  await LeaveBalance.updateOne({ user: leave.employee._id || leave.employee, leaveType: leave.leaveType._id || leave.leaveType, year: leave.year }, { $inc: inc });
}
