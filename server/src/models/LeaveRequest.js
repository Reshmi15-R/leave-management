import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = admin/GM pool
    status: { type: String, enum: ['waiting', 'pending', 'approved', 'rejected', 'skipped'], default: 'waiting' },
    comment: { type: String, default: '' },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actedAt: { type: Date, default: null },
    overridden: { type: Boolean, default: false }, // acted on by someone other than the assigned approver
  },
  { _id: false }
);

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    halfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ['first', 'second', null], default: null },
    days: { type: Number, required: true },
    year: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    documentRef: { type: String, default: '' },
    contactDuringLeave: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    approvals: [approvalSchema],
    currentLevel: { type: Number, default: 1 },
    isOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: '' },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, startDate: 1 });
leaveRequestSchema.index({ status: 1, 'approvals.approver': 1 });

export default mongoose.model('LeaveRequest', leaveRequestSchema);
