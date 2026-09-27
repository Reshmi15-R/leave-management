import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  name: { type: String, required: true, trim: true },
});

const settingsSchema = new mongoose.Schema(
  {
    organizationName: { type: String, default: 'My Organization' },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0 = Sunday
    holidays: [holidaySchema],
    allowNegativeBalance: { type: Boolean, default: false },
    // Requests longer than this many days need a second-level approval (0 disables)
    secondLevelApprovalThreshold: { type: Number, default: 5, min: 0 },
    maxBackdatedDays: { type: Number, default: 7, min: 0 },
    maxFutureDays: { type: Number, default: 365, min: 1 },
  },
  { timestamps: true }
);

settingsSchema.statics.get = async function () {
  let s = await this.findOne();
  if (!s) s = await this.create({});
  return s;
};

export default mongoose.model('Settings', settingsSchema);
