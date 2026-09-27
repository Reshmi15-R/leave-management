import mongoose from 'mongoose';

// Optional per-role entitlement overrides; null means "use defaultDays".
const roleEntitlementSchema = new mongoose.Schema(
  {
    team_member: { type: Number, default: null },
    team_leader: { type: Number, default: null },
    team_manager: { type: Number, default: null },
    general_manager: { type: Number, default: null },
    admin: { type: Number, default: null },
  },
  { _id: false }
);

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#2a78d6' },
    defaultDays: { type: Number, default: 0, min: 0 },
    roleEntitlements: { type: roleEntitlementSchema, default: () => ({}) },
    isPaid: { type: Boolean, default: true }, // unpaid types skip balance checks
    carryForward: { type: Boolean, default: false },
    maxCarryForward: { type: Number, default: 0, min: 0 },
    allowHalfDay: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    docRequiredAfterDays: { type: Number, default: 2, min: 0 },
    minNoticeDays: { type: Number, default: 0, min: 0 },
    maxConsecutiveDays: { type: Number, default: 0, min: 0 }, // 0 = no limit
    gender: { type: String, enum: ['all', 'male', 'female'], default: 'all' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('LeaveType', leaveTypeSchema);
