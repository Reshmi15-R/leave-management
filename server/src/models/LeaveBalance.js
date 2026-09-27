import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['allocation', 'carry_forward', 'adjustment', 'override'], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    year: { type: Number, required: true },
    allocated: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    adjusted: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    history: [historySchema],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

leaveBalanceSchema.index({ user: 1, leaveType: 1, year: 1 }, { unique: true });

const round = (n) => Math.round(n * 100) / 100;
leaveBalanceSchema.virtual('total').get(function () {
  return round(this.allocated + this.carriedForward + this.adjusted);
});
leaveBalanceSchema.virtual('available').get(function () {
  return round(this.allocated + this.carriedForward + this.adjusted - this.used - this.pending);
});

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
